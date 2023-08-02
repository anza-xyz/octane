import type { NextApiRequest, NextApiResponse } from 'next';
import { Connection } from '@solana/web3.js';

import { PayerUtils, core } from '@solana/octane-core';
import { cors, ENV_API_KEY, ENV_SECRET_KEYPAIR, rateLimit } from '../../src';

import config from '../../../../config.json';

/** Minimum amount of tokens to swap to SOL (in lamports). */
const threshold = 100_000_000; // 0.1 SOL

/*
  Swap code based on `packages/server/src/cli.ts`.
  `ENV_API_KEY` variable, loaded from `API_KEY` environment variable, was added 
  for this endpoint.
*/

/**
 * Body arguments:
 * - `apiKey`: API key to use for this request. Should match `API_KEY` environment variable.
 */
export default async function handler(request: NextApiRequest, response: NextApiResponse) {
    await cors(request, response);
    await rateLimit(request, response);

    if (request.method !== 'POST') {
        response.status(405).send({ status: 'error', message: 'Method not allowed, only POST is allowed' });
        return;
    }

    if (!ENV_API_KEY) {
        response.status(500).send({ status: 'error', message: 'API key is not set' });
        return;
    }

    if (request.body.apiKey !== ENV_API_KEY) {
        response.status(403).send({ status: 'error', message: 'Invalid API key' });
        return;
    }

    const secretKeypair = ENV_SECRET_KEYPAIR;
    const connection = new Connection(config.rpcUrl, 'confirmed');

    const tokenFees = config.endpoints.transfer.tokens.map((token) => core.TokenFee.fromSerializable(token));
    const routesToSwap = await PayerUtils.loadSwapRoutesForTokenFees(connection, tokenFees, threshold, 0.5);

    if (routesToSwap.length === 0) {
        const message = 'No tokens to swap (considers threshold)';
        response.status(200).send({ status: 'ok', message });
        return;
    }

    const executedTransactions: string[] = [];
    for (const route of routesToSwap) {
        const txids = await PayerUtils.executeSwapByRoute(connection, secretKeypair, route);
        executedTransactions.push(...txids);
        console.log(`Executed transactions:`, txids);
    }

    response.status(200).send({ status: 'ok', executedTransactions });
}
