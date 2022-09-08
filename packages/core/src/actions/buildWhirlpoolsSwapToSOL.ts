import BN from 'bn.js';
import { Connection, Keypair, PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js';
import {
    createTransferInstruction,
    getAssociatedTokenAddress,
    getMinimumBalanceForRentExemptAccount,
    NATIVE_MINT,
} from '@solana/spl-token';
import {
    SwapQuote,
} from '@orca-so/whirlpools-sdk';
import { Percentage } from '@orca-so/common-sdk';
import type { Cache } from 'cache-manager';

import { simulateRawTransaction, isMainnetBetaCluster, MessageToken } from '../core';
import { whirlpools } from '../swapProviders';

export type FeeOptions = {
    amount: number,
    sourceAccount: PublicKey,
    destinationAccount: PublicKey,
};

/**
 * Builds an unsigned transaction that performs a swap to SOL and optionally sends a token fee to Octane
 *
 * @param connection
 * @param feePayer
 * @param user
 * @param sourceMint
 * @param amount
 * @param slippingTolerance
 * @param cache
 * @param sameMintTimeout A required interval for transactions with same source mint and user, ms
 * @param feeOptions?
 *
 * @return Transaction
 */
export async function buildWhirlpoolsSwapToSOL(
    connection: Connection,
    feePayer: Keypair,
    user: PublicKey,
    sourceMint: PublicKey,
    amount: BN,
    slippingTolerance: Percentage,
    cache: Cache,
    sameMintTimeout = 3000,
    feeOptions?: FeeOptions,
): Promise<{ transaction: Transaction; quote: SwapQuote, messageToken: string }> {
    // Connection's genesis hash is cached to prevent an extra RPC query to the node on each call.
    const genesisHashKey = `genesis/${connection.rpcEndpoint}`;
    let genesisHash = await cache.get<string>(genesisHashKey);
    if (!genesisHash) {
        genesisHash = await connection.getGenesisHash();
        await cache.set<string>(genesisHashKey, genesisHash);
    }
    if (!isMainnetBetaCluster(genesisHash)) {
        throw new Error('Whirlpools endpoint can only run attached to the mainnet-beta cluster');
    }

    if (amount.lte(new BN(0))) {
        throw new Error('Amount can\'t be zero or less');
    }

    if (feeOptions && feeOptions.amount < 0) {
        throw new Error('Fee can\'t be less than zero');
    }

    const key = `swap/${user.toString()}/${sourceMint.toString()}`;
    const lastSignature = await cache.get<number>(key);
    if (lastSignature && Date.now() - lastSignature < sameMintTimeout) {
        throw new Error('Too many requests for same user and mint');
    }
    // cache.set() is in the end of the function

    const associatedSOLAddress = await getAssociatedTokenAddress(NATIVE_MINT, user);
    if ((await connection.getAccountInfo(associatedSOLAddress))) {
        throw new Error('Associated SOL account exists for user');
    }

    const context = whirlpools.getWhirlpoolsContext(connection);
    const [mintA, mintB] = whirlpools.getABMints(sourceMint, NATIVE_MINT);
    const [whirlpool, quote] = await whirlpools.getPoolAndQuote(
        context,
        mintA,
        mintB,
        sourceMint,
        amount,
        slippingTolerance
    );

    const swapInstructions = await whirlpools.getSwapInstructions(
        feePayer.publicKey,
        user,
        context,
        whirlpool,
        quote,
        await getMinimumBalanceForRentExemptAccount(connection),
    );

    let feeTransferInstruction: TransactionInstruction | undefined;
    if (feeOptions !== undefined) {
        feeTransferInstruction = createTransferInstruction(
            feeOptions.sourceAccount,
            feeOptions.destinationAccount,
            user,
            feeOptions.amount,
        );
    }

    const instructions = feeTransferInstruction ? [feeTransferInstruction, ...swapInstructions] : swapInstructions;
    const transaction = new Transaction({
        feePayer: feePayer.publicKey,
        ...(await connection.getLatestBlockhash()),
    }).add(...instructions);

    await simulateRawTransaction(
        connection,
        transaction.serialize({verifySignatures: false}),
    );

    const messageToken = new MessageToken(
        whirlpools.MESSAGE_TOKEN_KEY,
        transaction.compileMessage(),
        feePayer
    ).compile();

    // set last signature for mint and user
    await cache.set<number>(key, Date.now());

    return {transaction, quote, messageToken};
}
