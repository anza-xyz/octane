import { Connection, Keypair, PublicKey, SystemProgram, TransactionInstruction } from '@solana/web3.js';
import {
    buildWhirlpoolClient,
    PDAUtil,
    PoolUtil,
    SwapQuote, swapQuoteByInputToken,
    Whirlpool,
    WhirlpoolContext, WhirlpoolIx,
} from '@orca-so/whirlpools-sdk';
import { Wallet } from '@project-serum/anchor';
import { AddressUtil, Percentage } from '@orca-so/common-sdk';
import BN from 'bn.js';
import {
    createAssociatedTokenAccountInstruction,
    createCloseAccountInstruction,
    getAssociatedTokenAddress,
    NATIVE_MINT,
} from '@solana/spl-token';

const WHIRLPOOL_PROGRAM_ID = new PublicKey('whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc');
const WHIRLPOOL_CONFIG_KEY = new PublicKey('2LecshUwdy9xi7meFgHtFJQNSKk4KdTrcpvaB56dP2NQ');
const WHIRLPOOL_TICK_SPACING = 64;

export const MESSAGE_TOKEN_KEY = 'whirlpools-swap';

export function getWhirlpoolsContext(connection: Connection): WhirlpoolContext {
    // We use the context only for getting quotes and looking up instructions, so no need for real keypair
    const wallet = new Wallet(Keypair.generate());
    return WhirlpoolContext.from(connection, wallet, WHIRLPOOL_PROGRAM_ID);
}

export function getABMints(sourceMint: PublicKey, targetMint: PublicKey): [PublicKey, PublicKey] {
    const [addressA, addressB] = PoolUtil.orderMints(sourceMint, targetMint);
    return [AddressUtil.toPubKey(addressA), AddressUtil.toPubKey(addressB)];
}

export async function getPoolAndQuote(
    context: WhirlpoolContext,
    mintA: PublicKey,
    mintB: PublicKey,
    sourceMint: PublicKey,
    amount: BN,
    slippingTolerance: Percentage
): Promise<[Whirlpool, SwapQuote]> {
    const client = buildWhirlpoolClient(context);
    const whirlpoolKey = PDAUtil.getWhirlpool(
        WHIRLPOOL_PROGRAM_ID,
        WHIRLPOOL_CONFIG_KEY,
        AddressUtil.toPubKey(mintA),
        AddressUtil.toPubKey(mintB),
        WHIRLPOOL_TICK_SPACING
    );
    const whirlpool = await client.getPool(whirlpoolKey.publicKey, true);
    const quote = await swapQuoteByInputToken(
        whirlpool,
        sourceMint,
        amount,
        slippingTolerance,
        WHIRLPOOL_PROGRAM_ID,
        context.fetcher,
        true,
    );
    return [whirlpool, quote];
}

export async function getSwapInstructions(
    feePayer: PublicKey,
    user: PublicKey,
    context: WhirlpoolContext,
    whirlpool: Whirlpool,
    quote: SwapQuote,
    rentExemptBalance: number,
): Promise<TransactionInstruction[]> {
    const associatedSOLAddress = await getAssociatedTokenAddress(NATIVE_MINT, user);
    const setupInstructions = [
        createAssociatedTokenAccountInstruction(
            feePayer,
            associatedSOLAddress,
            user,
            NATIVE_MINT
        )
    ];

    const data = whirlpool.getData();
    const swapInstructions = WhirlpoolIx.swapIx(
        context.program,
        {
            ...quote,
            whirlpool: whirlpool.getAddress(),
            tokenAuthority: user,
            tokenOwnerAccountA: await getAssociatedTokenAddress(data.tokenMintA, user),
            tokenVaultA: data.tokenVaultA,
            tokenOwnerAccountB: await getAssociatedTokenAddress(data.tokenMintB, user),
            tokenVaultB: data.tokenVaultB,
            oracle: PDAUtil.getOracle(WHIRLPOOL_PROGRAM_ID, whirlpool.getAddress()).publicKey
        }
    ).instructions;

    const cleanupInstructions = [
        createCloseAccountInstruction(
            associatedSOLAddress,
            user,
            user
        ),
        // createAssociatedTokenAccountInstruction transfers rent-exemption minimum from Octane to newly created token account.
        // when createCloseAccountInstruction sent the SOL output to user, it also included this rent-exemption minimum.
        SystemProgram.transfer({
            fromPubkey: user,
            toPubkey: feePayer,
            lamports: rentExemptBalance,
        }),
    ];

    return [...setupInstructions, ...swapInstructions, ...cleanupInstructions];
}
