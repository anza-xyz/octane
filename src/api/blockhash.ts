import { Connection } from '@solana/web3.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ENV_RPC_URL } from '../core/env';
import { rateLimit } from '../middleware/rateLimit';

// Endpoint to get the most recent blockhash seen by Octane's RPC node
export default async function (request: VercelRequest, response: VercelResponse) {
    await rateLimit(request, response);

    const connection = new Connection(ENV_RPC_URL, 'confirmed');

    const blockhash = await connection.getRecentBlockhash();

    response.status(200).send({ blockhash });
}
