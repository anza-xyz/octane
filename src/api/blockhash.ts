import type { VercelRequest, VercelResponse } from '@vercel/node';
import { connection } from '../core';
import { rateLimit } from '../middleware';

// Endpoint to get the most recent blockhash seen by Octane's RPC node
export default async function (request: VercelRequest, response: VercelResponse) {
    await rateLimit(request, response);

    const blockhash = await connection.getRecentBlockhash();

    response.status(200).send({ blockhash });
}
