import { Connection, PublicKey, SimulatedTransactionResponse, Transaction } from '@solana/web3.js';

// Simulate a signed, serialized transaction before broadcasting
export async function simulateRawTransaction(
    connection: Connection,
    rawTransaction: Buffer,
    includeAccounts?: boolean | Array<PublicKey>
): Promise<SimulatedTransactionResponse> {
    /*
       Simulating a transaction directly can cause the `signatures` property to change.
       Possibly related:
       https://github.com/solana-labs/solana/issues/21722
       https://github.com/solana-labs/solana/pull/21724
       https://github.com/solana-labs/solana/issues/20743
       https://github.com/solana-labs/solana/issues/22021

       Clone it from the bytes instead, and make sure it's likely to succeed before paying for it.
     */
    const simulated = await connection.simulateTransaction(
        Transaction.from(rawTransaction),
        undefined,
        includeAccounts
    );
    if (simulated.value.err) throw simulated.value.err;

    return simulated.value;
}
