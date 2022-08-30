import axios from 'axios';
import { PublicKey, Transaction } from '@solana/web3.js';
import { NATIVE_MINT } from '@solana/spl-token';

export type TokenPriceInfo = {
    id: string;
    mintSymbol: string;
    vsToken: string;
    vsTokenSymbol: string;
    price: number;
}

type TokenPriceInfoResponse = {
    data: TokenPriceInfo;
    timeTaken: number;
}

export type Route = {
    inAmount: number;
    outAmount: number;
    amount: number;
    otherAmountThreshold: number;
    outAmountWithSlippage: number;
    swapMode: string;
    priceImpactPct: number;
    marketInfos: RouteMarketInfo[];
}

export type RouteMarketInfo = {
    id: string;
    label: string;
    inputMint: string;
    outputMint: string;
    inAmount: number;
    outAmount: number;
    lpFee: RouteFee;
    platformFee: RouteFee;
    notEnoughLiquidity: boolean;
    priceImpactPct: number;
    minInAmount?: number;
    minOutAmount?: number;
}

export type RouteFee = {
    amount: number;
    mint: string;
    pct: number;
}

type RoutesResponse = {
    data: Route[];
    timeTaken: number;
    contextSlot: string;
}

export type SwapTransactions = {
    setup: Transaction | null;
    swap: Transaction | null;
    cleanup: Transaction | null;
}

type SwapTransactionsResponse = {
    setupTransaction: string | null;
    swapTransaction: string | null;
    cleanupTransaction: string | null;
}

export async function getPopularTokens(count: number, excludeNative = true): Promise<PublicKey[]> {
    const response = await axios.get('https://cache.jup.ag/top-tokens');
    const mints = response.data.map((mint: string) => new PublicKey(mint)) as PublicKey[];
    const filteredMints = excludeNative ? mints.filter(value => !value.equals(NATIVE_MINT)) : mints;
    return filteredMints.slice(0, count);
}

export async function getTokenToNativePriceInfo(mint: PublicKey): Promise<TokenPriceInfo> {
    const priceInfoResponse = (
        await axios.get('https://price.jup.ag/v1/price', {params: {id: 'SOL', vsToken: mint.toBase58()}})
    ).data as TokenPriceInfoResponse;
    return priceInfoResponse.data;
}

export async function getRoutes(
    inputMint: PublicKey,
    outputMint: PublicKey,
    amount: BigInt,
    slippage: number
): Promise<Route[]> {
    const params = {
        inputMint: inputMint.toBase58(),
        outputMint: outputMint.toBase58(),
        amount: amount,
        slippage: slippage,
    };
    const routesResponse = (await axios.get(
        'https://quote-api.jup.ag/v1/quote', { params }
    )).data as RoutesResponse;
    return routesResponse.data;
}

export async function getSwapTransactions(wallet: PublicKey, route: Route): Promise<SwapTransactions> {
    const decodeTransactionOrNull = (serialized: string | null) => (
        serialized !== null ? Transaction.from(Buffer.from(serialized, 'base64')) : null
    );

    const response = (
        await axios.post('https://quote-api.jup.ag/v1/swap', {
            route,
            userPublicKey: wallet.toString(),
            wrapUnwrapSOL: true,
        }, {
            headers: { 'Content-Type': 'application/json' }
        })
    ).data as SwapTransactionsResponse;
    return {
        setup: decodeTransactionOrNull(response.setupTransaction),
        swap: decodeTransactionOrNull(response.swapTransaction),
        cleanup: decodeTransactionOrNull(response.cleanupTransaction),
    }
}

