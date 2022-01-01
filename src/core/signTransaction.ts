import { Transaction, TransactionSignature } from '@solana/web3.js';
import base58 from 'bs58';
import { ENV_SECRET_KEYPAIR } from './env';

// Sign a transaction for simulation and broadcast
export function signTransaction(transaction: Transaction): TransactionSignature {
    // Add the fee payer signature
    transaction.partialSign(ENV_SECRET_KEYPAIR);

    // Return the primary signature (aka txid)
    return base58.encode(transaction.signatures[0].signature!);
}
