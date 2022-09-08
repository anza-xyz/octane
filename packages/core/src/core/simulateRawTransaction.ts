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

       Within simulateTransaction there is a "transaction instanceof Transaction" check. Since connection is passed
       from outside the library, it uses parent application's version of web3.js. "instanceof" won't recognize a match.
       Instead, let's explicitly call for simulateTransaction within the dependency of the library.
     */
    const simulated = await Connection.prototype.simulateTransaction.call(
        connection,
        Transaction.from(rawTransaction),
        undefined,
        includeAccounts
    );
    if (simulated.value.err) throw new Error('Simulation error');

    return simulated.value;
}
