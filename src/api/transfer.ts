import { sendAndConfirmRawTransaction, Transaction } from '@solana/web3.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import base58 from 'bs58';
import { cache, connection, sha256, simulateRawTransaction, validateTransaction, validateTransfer } from '../core';
import { rateLimit } from '../middleware';

// Endpoint to pay for transactions with an SPL token transfer
export default async function (request: VercelRequest, response: VercelResponse) {
    await rateLimit(request, response);

    // Deserialize a base58 wire-encoded transaction from the request
    const serialized = request.body?.transaction;
    if (typeof serialized !== 'string') throw new Error('invalid transaction');
    const transaction = Transaction.from(base58.decode(serialized));

    // Prevent simple duplicate transactions using a hash of the message
    let key = `transaction/${base58.encode(sha256(transaction.serializeMessage()))}`;
    if (await cache.get(key)) throw new Error('duplicate transaction');
    await cache.set(key, true);

    // Check that the transaction is basically valid, sign it, and serialize it, verifying the signatures
    const { signature, rawTransaction } = await validateTransaction(transaction);

    // Check that the transaction contains a valid transfer to Octane's token account
    const transfer = await validateTransfer(transaction);

    /*
       An attacker could make multiple signing requests before the transaction is confirmed. If the source token account
       has the minimum fee balance, validation and simulation of all these requests may succeed. All but the first
       confirmed transaction will fail because the account will be empty afterward. To prevent this race condition,
       simulation abuse, or similar attacks, we implement a simple lockout for the source token account until the
       transaction succeeds or fails.
     */
    key = `transfer/${transfer.keys.source.pubkey.toBase58()}`;
    if (await cache.get(key)) throw new Error('duplicate transfer');
    await cache.set(key, true);

    try {
        // Simulate, send, and confirm the transaction
        await simulateRawTransaction(rawTransaction);
        await sendAndConfirmRawTransaction(connection, rawTransaction, { commitment: 'confirmed' });
    } finally {
        await cache.del(key);
    }

    // Respond with the confirmed transaction signature
    response.status(200).send({ signature });
}
