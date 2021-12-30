import { Transaction } from '@solana/web3.js';
import { connection } from './connection';
import { ENV_FEE_PAYER, ENV_LAMPORTS_PER_SIGNATURE } from './env';

// Check that a transaction is basically valid
export async function validateTransaction(transaction: Transaction): Promise<void> {
    // Check the fee payer and blockhash for basic validity
    if (!transaction.feePayer?.equals(ENV_FEE_PAYER)) throw new Error('invalid fee payer');
    if (!transaction.recentBlockhash) throw new Error('missing recent blockhash');

    // Check Octane's RPC node for the blockhash to make sure it's synced and the fee is reasonable
    const feeCalculator = await connection.getFeeCalculatorForBlockhash(transaction.recentBlockhash);
    if (!feeCalculator.value) throw new Error('blockhash not found');
    if (feeCalculator.value.lamportsPerSignature > ENV_LAMPORTS_PER_SIGNATURE) throw new Error('fee too high');

    // Check the signatures to make sure the first is the fee payer (empty) and the second is the user (nonempty)
    if (transaction.signatures.length > 2) throw new Error('too many signatures');
    if (transaction.signatures[0].signature) throw new Error('invalid fee payer signature');
    if (!transaction.signatures[0].publicKey.equals(ENV_FEE_PAYER)) throw new Error('invalid fee payer pubkey');
    if (!transaction.signatures[1].signature) throw new Error('missing signature');

    // Prevent draining by making sure that the fee payer isn't provided as writable or a signer to any instruction
    for (const instruction of transaction.instructions) {
        for (const key of instruction.keys) {
            if ((key.isWritable || key.isSigner) && key.pubkey.equals(ENV_FEE_PAYER))
                throw new Error('invalid account');
        }
    }
}
