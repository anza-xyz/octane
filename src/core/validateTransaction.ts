import { Transaction, TransactionSignature } from '@solana/web3.js';
import base58 from 'bs58';
import config from '../../config.json';
import { connection } from './connection';
import { ENV_FEE_PAYER, ENV_SECRET_KEYPAIR } from './env';

// Check that a transaction is basically valid, sign it, and serialize it, verifying the signatures
export async function validateTransaction(
    transaction: Transaction
): Promise<{ signature: TransactionSignature; rawTransaction: Buffer }> {
    // Check the fee payer and blockhash for basic validity
    if (!transaction.feePayer?.equals(ENV_FEE_PAYER)) throw new Error('invalid fee payer');
    if (!transaction.recentBlockhash) throw new Error('missing recent blockhash');

    // TODO: handle nonce accounts?

    // Check Octane's RPC node for the blockhash to make sure it's synced and the fee is reasonable
    const feeCalculator = await connection.getFeeCalculatorForBlockhash(transaction.recentBlockhash);
    if (!feeCalculator.value) throw new Error('blockhash not found');
    if (feeCalculator.value.lamportsPerSignature > config.lamportsPerSignature) throw new Error('fee too high');

    // Check the signatures for length, the primary signature, and secondary signature(s)
    if (!transaction.signatures.length) throw new Error('no signatures');
    if (transaction.signatures.length > config.maxSignatures) throw new Error('too many signatures');

    const [primary, ...secondary] = transaction.signatures;
    if (!primary.publicKey.equals(ENV_FEE_PAYER)) throw new Error('invalid fee payer pubkey');
    if (primary.signature) throw new Error('invalid fee payer signature');

    for (const signature of secondary) {
        if (!signature.publicKey) throw new Error('missing public key');
        if (!signature.signature) throw new Error('missing signature');
    }

    // Prevent draining by making sure that the fee payer isn't provided as writable or a signer to any instruction
    for (const instruction of transaction.instructions) {
        for (const key of instruction.keys) {
            if ((key.isWritable || key.isSigner) && key.pubkey.equals(ENV_FEE_PAYER))
                throw new Error('invalid account');
        }
    }

    // Add the fee payer signature
    transaction.partialSign(ENV_SECRET_KEYPAIR);

    // Serialize the transaction, verifying the signatures
    const rawTransaction = transaction.serialize();

    // Return the primary signature (aka txid) and serialized transaction
    return { signature: base58.encode(transaction.signature!), rawTransaction };
}
