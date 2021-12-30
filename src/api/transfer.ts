import { sendAndConfirmRawTransaction, Transaction } from '@solana/web3.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import base58 from 'bs58';
import { connection, signAndSimulateTransaction, validateTransaction, validateTransfer } from '../core';
import { rateLimit } from '../middleware';

// Endpoint to pay for transactions with an SPL token transfer
export default async function (request: VercelRequest, response: VercelResponse) {
    await rateLimit(request, response);

    // Deserialize a base58 wire-encoded transaction from the request
    if (typeof request.body?.transaction !== 'string') throw new Error('invalid request body');

    const transaction = Transaction.from(base58.decode(request.body.transaction));

    // Check that the transaction is basically valid and contains a valid transfer to Octane's account
    await validateTransaction(transaction);
    await validateTransfer(transaction);

    // Sign, send, and confirm the transaction
    const rawTransaction = await signAndSimulateTransaction(transaction);

    // FIXME:
    // a spammer could make several signing requests before the transaction is sent
    // if the source token account account has the minimum balance, checks and simulation of all will succeed
    // then all but the first broadcast transaction to confirm will fail because the account is empty
    // we could add a timed lockout for the source token account to prevent this

    const signature = await sendAndConfirmRawTransaction(connection, rawTransaction, { commitment: 'confirmed' });

    // Respond with the transaction signature
    response.status(200).send({ signature });
}
