import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { TokenFee } from '../core';
import { createAssociatedTokenAccount, getAssociatedTokenAddress } from '@solana/spl-token';

export type CreateAccount = {
    address: PublicKey;
    mint: PublicKey;
};

export type CreateAccountResult = {
    address: PublicKey;
    mint: PublicKey;
    error: Error | null;
};

export async function buildCreateAccountListFromTokenFees(
    connection: Connection,
    feePayer: PublicKey,
    tokenFees: TokenFee[]
): Promise<CreateAccount[]> {
    let createAccounts: CreateAccount[] = [];
    for (const tokenFee of tokenFees) {
        const alreadyCreated = await connection.getAccountInfo(tokenFee.account);
        if (alreadyCreated) {
            continue;
        }

        const associatedWithFeePayer = tokenFee.account.equals(
            await getAssociatedTokenAddress(tokenFee.mint, feePayer)
        );
        if (!associatedWithFeePayer) {
            continue;
        }

        createAccounts.push({ mint: tokenFee.mint, address: tokenFee.account });
    }

    return createAccounts;
}

export async function createAccounts(
    connection: Connection,
    feePayer: Keypair,
    accounts: CreateAccount[]
): Promise<CreateAccountResult[]> {
    let results: CreateAccountResult[] = [];

    for (const account of accounts) {
        let error: Error | null = null;
        try {
            await createAssociatedTokenAccount(
                connection,
                feePayer,
                account.mint,
                feePayer.publicKey,
            );
        } catch (e) {
            error = e as Error;
        }

        results.push({...account, error})
    }

    return results;
}
