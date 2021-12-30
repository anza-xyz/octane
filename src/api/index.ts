import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
    ENV_FEE_PAYER,
    ENV_TRANSFER_ACCOUNT,
    ENV_TRANSFER_DECIMALS,
    ENV_TRANSFER_FEE,
    ENV_TRANSFER_MINT,
} from '../core';
import { rateLimit } from '../middleware';

const body = {
    publicKey: ENV_FEE_PAYER.toBase58(),
    endpoints: {
        transfer: {
            mint: ENV_TRANSFER_MINT.toBase58(),
            account: ENV_TRANSFER_ACCOUNT.toBase58(),
            decimals: ENV_TRANSFER_DECIMALS,
            fee: ENV_TRANSFER_FEE.toString(),
        },
    },
};

// Endpoint to get the Octane's configuration
export default async function (request: VercelRequest, response: VercelResponse) {
    await rateLimit(request, response);

    response.status(200).send(body);
}
