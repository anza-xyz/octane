import { Connection, Transaction } from '@solana/web3.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import base58 from 'bs58';
import {
    confirmTransaction,
    ENV_RPC_URL,
    signAndSendTransaction,
    validateTransaction,
    validateTransfer,
} from '../core';
import { rateLimit } from '../middleware';

// Endpoint to pay for transactions with an SPL token transfer
export default async function (request: VercelRequest, response: VercelResponse) {
    await rateLimit(request, response);

    // Deserialize a base58 wire-encoded transaction from the request
    if (typeof request.body?.transaction !== 'string') throw new Error('invalid request body');

    const transaction = Transaction.from(base58.decode(request.body.transaction));

    // Connect to the RPC node to query, simulate, and broadcast
    const connection = new Connection(ENV_RPC_URL, 'confirmed');

    // Check that the transaction is basically valid and contains a valid transfer to Octane's account
    await validateTransaction(transaction, connection);
    await validateTransfer(transaction, connection);

    // FIXME:
    // a spammer could make several signing requests before the transaction is sent
    // if the source token account account has the minimum balance, checks and simulation of all will succeed
    // then all but the first broadcast transaction to confirm will fail because the account is empty
    // we could add a timed lockout for the source token account to prevent this

    // Sign, send, and confirm the transaction
    const signature = await signAndSendTransaction(transaction, connection);

    await confirmTransaction(signature, connection);

    // Respond with the transaction signature
    response.status(200).send({ signature });
}
