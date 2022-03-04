import { Transaction, Connection, Keypair } from '@solana/web3.js';
import type { Cache } from 'cache-manager';
import base58 from 'bs58';
import { sha256, simulateRawTransaction, validateTransaction, validateTransfer, AllowedToken } from '../core';

/**
 * Sign transaction by fee payer if the first instruction is a transfer of token fee to given account
 *
 * @param connection           Connection to a Solana node
 * @param transaction          Transaction to sign
 * @param maxSignatures        Maximum allowed signatures in the transaction including fee payer's
 * @param lamportsPerSignature Maximum fee payment in lamports
 * @param allowedTokens        List of tokens that can be used with token fee receiver accounts and fee details
 * @param feePayer             Keypair for fee payer
 * @param cache                A cache to store duplicate transactions
 *
 * @return {signature: string} Transaction signature by fee payer
 */
export async function signWithTokenFee(
    connection: Connection,
    transaction: Transaction,
    feePayer: Keypair,
    maxSignatures: number,
    lamportsPerSignature: number,
    allowedTokens: AllowedToken[],
    cache: Cache
): Promise<{ signature: string }> {
    // Prevent simple duplicate transactions using a hash of the message
    let key = `transaction/${base58.encode(sha256(transaction.serializeMessage()))}`;
    if (await cache.get(key)) throw new Error('duplicate transaction');
    await cache.set(key, true);

    // Check that the transaction is basically valid, sign it, and serialize it, verifying the signatures
    const { signature, rawTransaction } = await validateTransaction(
        connection,
        transaction,
        feePayer,
        maxSignatures,
        lamportsPerSignature
    );

    // Check that the transaction contains a valid transfer to Octane's token account
    const transfer = await validateTransfer(connection, transaction, allowedTokens);

    /*
       An attacker could make multiple signing requests before the transaction is confirmed. If the source token account
       has the minimum fee balance, validation and simulation of all these requests may succeed. All but the first
       confirmed transaction will fail because the account will be empty afterward. To prevent this race condition,
       simulation abuse, or similar attacks, we implement a simple lockout for the source token account until the
       transaction succeeds or fails.
     */
    key = `transfer/${transfer.keys.source.pubkey.toBase58()}`;
    if (await cache.get(key)) throw new Error('duplicate transfer');
    await cache.set(key, true);

    try {
        // Simulate, send, and confirm the transaction
        await simulateRawTransaction(connection, rawTransaction);
    } finally {
        await cache.del(key);
    }

    return { signature: signature };
}
