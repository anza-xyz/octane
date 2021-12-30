import { Transaction, TransactionSignature } from '@solana/web3.js';
import { connection } from './connection';
import { ENV_SECRET_KEYPAIR } from './env';

// Sign a transaction, simulate it, and broadcast it to the network
export async function signAndSendTransaction(transaction: Transaction): Promise<TransactionSignature> {
    // Add the fee payer signature
    transaction.partialSign(ENV_SECRET_KEYPAIR);

    // Serialize the transaction before simulating it, which can cause the `signatures` property to change
    const rawTransaction = transaction.serialize();

    // Simulate the transaction to make sure it's likely to succeed before paying for it
    const simulated = await connection.simulateTransaction(transaction);
    if (simulated.value.err) throw simulated.value.err;

    // Send the serialized the transaction to the RPC node
    return await connection.sendRawTransaction(rawTransaction);
}
