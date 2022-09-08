import type { NextApiRequest, NextApiResponse } from 'next';
import config from '../../../../config.json';
import { cors, ENV_FEE_PAYER, rateLimit } from '../../src';

const body = {
    feePayer: ENV_FEE_PAYER.toBase58(),
    ...config,
};

// Endpoint to get Octane's configuration
export default async function (request: NextApiRequest, response: NextApiResponse) {
    await cors(request, response);
    await rateLimit(request, response);

    response.status(200).send(body);
}
