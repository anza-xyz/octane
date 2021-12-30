import { clusterApiUrl, Keypair, PublicKey } from "@solana/web3.js";
import base58 from "bs58";

export const ENV_SECRET_KEYPAIR = Keypair.fromSecretKey(base58.decode(process.env.SECRET_KEY || ''));
export const ENV_FEE_PAYER = ENV_SECRET_KEYPAIR.publicKey;

export const ENV_LAMPORTS_PER_SIGNATURE = Number(process.env.LAMPORTS_PER_SIGNATURE) || 5000;

export const ENV_RPC_URL = process.env.RPC_URL || clusterApiUrl('devnet');

export const ENV_RATE_LIMIT = Number(process.env.RATE_LIMIT) || undefined;
export const ENV_RATE_LIMIT_INTERVAL = Number(process.env.RATE_LIMIT_INTERVAL) || undefined;

export const ENV_TRANSFER_MINT = new PublicKey(process.env.TRANSFER_MINT || '');
export const ENV_TRANSFER_ACCOUNT = new PublicKey(process.env.TRANSFER_ACCOUNT || '');
export const ENV_TRANSFER_DECIMALS = Number(process.env.TRANSFER_DECIMALS) || 0;
export const ENV_TRANSFER_FEE = BigInt((Number(process.env.TRANSFER_FEE) || 0) * 10 ** ENV_TRANSFER_DECIMALS);
