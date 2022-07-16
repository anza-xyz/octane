import type { NextApiRequest, NextApiResponse } from 'next';
import { connection, rateLimit } from '../../src';

// Endpoint to get the most recent blockhash seen by Octane's RPC node
export default async function (request: NextApiRequest, response: NextApiResponse) {
    await rateLimit(request, response);

    const blockhash = await connection.getRecentBlockhash();

    response.status(200).send({ blockhash });
}
