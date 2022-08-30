import { Connection, Keypair } from '@solana/web3.js';
import { getAccount, NATIVE_MINT } from '@solana/spl-token';
import { TokenFee } from '../core';
import { getRoutes, getSwapTransactions, Route } from './jupiter';

export async function loadSwapRoutesForTokenFees(
    connection: Connection,
    tokenFees: TokenFee[],
    thresholdInLamports: number,
    slippage: number = 0.5
): Promise<Route[]> {
    let routes = [];
    for (const tokenFee of tokenFees) {
        const account = await getAccount(connection, tokenFee.account);
        if (account.amount === 0n) {
            continue;
        }
        const route = (await getRoutes(
            tokenFee.mint, NATIVE_MINT, account.amount, slippage
        ))[0];
        if (route.outAmount < thresholdInLamports) {
            continue;
        }
        routes.push(route);
    }
    return routes;
}

export async function executeSwapByRoute(connection: Connection, feePayer: Keypair, route: Route): Promise<string[]> {
    const transactions = await getSwapTransactions(feePayer.publicKey, route);
    let txids = [];
    for (const transaction of [transactions.setup, transactions.swap, transactions.cleanup]) {
        if (transaction === null) {
            continue;
        }
        const txid = await connection.sendTransaction(
            transaction,
            [feePayer],
            { skipPreflight: true }
        );
        await connection.confirmTransaction(txid);
        txids.push(txid);
    }
    return txids;
}
