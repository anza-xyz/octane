import { Connection } from '@solana/web3.js';
import { ENV_RPC_URL } from './env';

export const connection = new Connection(ENV_RPC_URL, 'confirmed');
