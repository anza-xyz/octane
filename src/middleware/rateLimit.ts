import expressRateLimit from 'express-rate-limit';
import { ENV_RATE_LIMIT, ENV_RATE_LIMIT_INTERVAL } from '../core';
import { wrapExpressHandler } from './wrapExpressHandler';

// Just basic IP rate-limiting for now
export const rateLimit = wrapExpressHandler(
    expressRateLimit({
        max: ENV_RATE_LIMIT,
        windowMs: ENV_RATE_LIMIT_INTERVAL,
    })
);
