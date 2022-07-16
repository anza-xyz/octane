import expressRateLimit from 'express-rate-limit';
import { ENV_RATE_LIMIT, ENV_RATE_LIMIT_INTERVAL } from '../env';
import { wrapExpressHandler } from './wrapExpressHandler';

// Just basic IP rate-limiting for now
export const rateLimit = wrapExpressHandler(
    expressRateLimit({
        keyGenerator: (req) =>
            (req.headers['x-real-ip'] as string | undefined) ?? req.socket.remoteAddress ?? 'UNKNOWN',
        max: ENV_RATE_LIMIT ?? 10,
        windowMs: ENV_RATE_LIMIT_INTERVAL ?? 60,
    })
);
