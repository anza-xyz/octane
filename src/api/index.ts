import type { VercelRequest, VercelResponse } from '@vercel/node';
import config from '../../config.json';
import { ENV_FEE_PAYER } from '../core';
import { rateLimit } from '../middleware';

const body = {
    feePayer: ENV_FEE_PAYER.toBase58(),
    ...config,
};

// Endpoint to get Octane's configuration
export default async function (request: VercelRequest, response: VercelResponse) {
    await rateLimit(request, response);

    response.status(200).send(body);
}
