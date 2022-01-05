import { Keypair } from '@solana/web3.js';
import base58 from 'bs58';

export const ENV_SECRET_KEYPAIR = Keypair.fromSecretKey(base58.decode(process.env.SECRET_KEY || ''));
export const ENV_FEE_PAYER = ENV_SECRET_KEYPAIR.publicKey;
export const ENV_RATE_LIMIT = Number(process.env.RATE_LIMIT) || undefined;
export const ENV_RATE_LIMIT_INTERVAL = Number(process.env.RATE_LIMIT_INTERVAL) || undefined;
