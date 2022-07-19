import { Connection } from '@solana/web3.js';
import config from '../../../config.json';

export const connection = new Connection(config.rpcUrl, 'confirmed');
