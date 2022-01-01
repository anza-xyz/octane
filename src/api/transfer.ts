import { sendAndConfirmRawTransaction, Transaction, TransactionSignature } from '@solana/web3.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import base58 from 'bs58';
import { connection, signTransaction, simulateRawTransaction, validateTransaction, validateTransfer } from '../core';
import { rateLimit } from '../middleware';

const locked = new Set<string>();

// Endpoint to pay for transactions with an SPL token transfer
export default async function (request: VercelRequest, response: VercelResponse) {
    await rateLimit(request, response);

    // Deserialize a base58 wire-encoded transaction from the request
    if (typeof request.body?.transaction !== 'string') throw new Error('invalid request body');

    const transaction = Transaction.from(base58.decode(request.body.transaction));

    // Check that the transaction is basically valid and contains a valid transfer to Octane's token account
    await validateTransaction(transaction);

    const transfer = await validateTransfer(transaction);

    /*
       An attacker could make several signing requests before the transaction is confirmed. If the source token account
       has the minimum fee balance, validation and simulation of all these requests will succeed. All but the first
       confirmed transaction will fail because the account will be empty afterward. To prevent this race condition,
       simulation abuse, or similar attacks, we implement a simple lockout for the source token account until the
       transaction succeeds or fails.
     */
    const source = transfer.keys.source.pubkey.toBase58();
    if (locked.has(source)) throw new Error('source locked');
    locked.add(source);

    let signature: TransactionSignature;
    try {
        // Temporarily lockout the unique transaction signature too
        signature = signTransaction(transaction);
        if (locked.has(signature)) throw new Error('duplicate transaction');
        locked.add(signature);

        try {
            // Serialize, simulate, send, and confirm the transaction
            const rawTransaction = transaction.serialize();
            await simulateRawTransaction(rawTransaction);
            await sendAndConfirmRawTransaction(connection, rawTransaction, { commitment: 'confirmed' });
        } finally {
            locked.delete(signature);
        }
    } finally {
        locked.delete(source);
    }

    // Respond with the confirmed transaction signature
    response.status(200).send({ signature });
}
