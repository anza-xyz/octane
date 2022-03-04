import type { NextApiRequest, NextApiResponse } from 'next';
import config from '../../config.json';
import { ENV_FEE_PAYER } from '../../src/helpers/env';
import { rateLimit } from '../../src/middleware';

const body = {
    feePayer: ENV_FEE_PAYER.toBase58(),
    ...config,
};

// Endpoint to get Octane's configuration
export default async function (request: NextApiRequest, response: NextApiResponse) {
    await rateLimit(request, response);

    response.status(200).send(body);
}
