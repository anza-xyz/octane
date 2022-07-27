import { Connection, Transaction, Keypair, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { getMint, getAssociatedTokenAddress } from '@solana/spl-token';
import axios from 'axios';

type TokenPriceInfo = {
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

type TokenConfigEntry = {
    mint: string;
    account: string;
    decimals: number;
    fee: number;
}

export async function getLamportsPerSignature(connection: Connection): Promise<number> {
    const transaction = new Transaction();
    transaction.feePayer = Keypair.generate().publicKey;
    transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    return (await connection.getFeeForMessage(transaction.compileMessage())).value;
}

export async function loadPopularTokensFromJupiter(count: number): Promise<PublicKey[]> {
    const mints = (
        (await axios.get('https://cache.jup.ag/top-tokens')).data.map((mint: string) => new PublicKey(mint))
    ) as PublicKey[];
    return mints
        .filter(value => !value.equals(new PublicKey('So11111111111111111111111111111111111111112'))) // Exclude the SOL token itself
        .slice(0, count);
}

export async function createTokenConfigEntry(
    connection: Connection,
    feePayer: PublicKey,
    mint: PublicKey,
    costInLamports: number,
    margin: number,
): Promise<TokenConfigEntry> {
    const priceInfoResponse = (
        await axios.get('https://price.jup.ag/v1/price', {params: {id: 'SOL', vsToken: mint.toBase58()}})
    ).data as TokenPriceInfoResponse;
    const priceInfo = priceInfoResponse.data;
    const tokenInfo = await getMint(connection, new PublicKey(mint));

    const tokenPricePerSignature = priceInfo.price / LAMPORTS_PER_SOL * costInLamports;

    // for example, price is 0.01, margin is 0.9, then (1 / (1 - margin)) = 10 and price after margin is 0.1.
    const tokenPriceAfterMargin = tokenPricePerSignature * (1 / (1 - margin));

    const tokenPriceInDecimalNotation = Math.floor(tokenPriceAfterMargin * (10 ** tokenInfo.decimals)) + 1;

    return {
        mint: mint.toBase58(),
        account: (await getAssociatedTokenAddress(mint, feePayer)).toBase58(),
        decimals: tokenInfo.decimals,
        fee: tokenPriceInDecimalNotation,
    };
}

export async function createTokenConfigEntries(
    connection: Connection,
    feePayer: PublicKey,
    mints: PublicKey[],
    costInLamports: number,
    margin: number,
): Promise<TokenConfigEntry[]> {
    return Promise.all(mints.map(
        async mint => await createTokenConfigEntry(
            connection,
            feePayer,
            mint,
            costInLamports,
            margin,
        )
    ));
}
