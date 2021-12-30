import { Transaction } from '@solana/web3.js';
import { connection } from './connection';
import { ENV_SECRET_KEYPAIR } from './env';

// Sign a transaction, simulate it, broadcast it to the network, and wait for confirmation
export async function signAndSimulateTransaction(transaction: Transaction): Promise<Buffer> {
    // Add the fee payer signature
    transaction.partialSign(ENV_SECRET_KEYPAIR);

    // Serialize the transaction before simulating it, which can cause the `signatures` property to change
    const rawTransaction = transaction.serialize();

    // Simulate the transaction to make sure it's likely to succeed before paying for it
    const simulated = await connection.simulateTransaction(transaction);
    if (simulated.value.err) throw simulated.value.err;

    return rawTransaction;
}
