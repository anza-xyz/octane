import type { NextApiRequest, NextApiResponse } from 'next';
import { Connection } from '@solana/web3.js';

import { PayerUtils, core } from '@solana/octane-core';
import { cors, ENV_SECRET_KEYPAIR, rateLimit } from '../../src';

import config from '../../../../config.json';

const threshold = 100_000_000; // 0.1 SOL

/*
  Based on packages/server/src/cli.ts
*/

export default async function (request: NextApiRequest, response: NextApiResponse) {
    await cors(request, response);
    await rateLimit(request, response);

    const secretKeypair = ENV_SECRET_KEYPAIR;
    const connection = new Connection(config.rpcUrl, 'confirmed');

    const tokenFees = config.endpoints.transfer.tokens.map((token) => core.TokenFee.fromSerializable(token));
    const routesToSwap = await PayerUtils.loadSwapRoutesForTokenFees(connection, tokenFees, threshold, 0.5);

    // console.log(`Routes to swap:`, routesToSwap);

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
