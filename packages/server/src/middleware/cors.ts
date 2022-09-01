import expressCors from 'cors';
import config from '../../../../config.json';
import { wrapExpressHandler } from './wrapExpressHandler';

export const cors = wrapExpressHandler(expressCors({ origin: config.corsOrigin, methods: ['GET', 'POST', 'OPTIONS'] }));
