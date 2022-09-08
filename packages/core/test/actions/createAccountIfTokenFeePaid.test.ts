import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import base58 from 'bs58';
// @ts-ignore (TS7016) There is no type definition for this at DefinitelyTyped.
import MemoryStore from 'cache-manager/lib/stores/memory';
import cacheManager from 'cache-manager';
import { Keypair, PublicKey, Connection, Transaction, sendAndConfirmRawTransaction } from '@solana/web3.js';
import {
    createMint,
    getAssociatedTokenAddress,
    getOrCreateAssociatedTokenAccount,
    Account,
    mintTo,
    createTransferInstruction,
    createAccount,
    getAccount,
    createAssociatedTokenAccountInstruction,
} from '@solana/spl-token';
import { createAccountIfTokenFeePaid } from '../../src';
import { TokenFee } from '../../src/core';
import { airdropLamports } from '../common';

use(chaiAsPromised);

if (process.env.TEST_LIVE) {
    describe('createAccountIfTokenFeePaid action', async () => {
        let connection: Connection;
        let feePayerKeypair: Keypair; // Payer for submitted transactions
        let tokenKeypair: Keypair; // Token owner
        let mint: PublicKey;
        let feePayerTokenAccount: Account; // Account for fees in tokens
        let baseAllowedTokens: TokenFee[];
        let cache: cacheManager.Cache;
        before(async () => {
            cache = cacheManager.caching({ store: MemoryStore, max: 1000, ttl: 120 });
            connection = new Connection('http://localhost:8899/', 'confirmed');
            feePayerKeypair = Keypair.generate();
            tokenKeypair = Keypair.generate();
            await airdropLamports(connection, tokenKeypair.publicKey, feePayerKeypair.publicKey);
            mint = await createMint(connection, tokenKeypair, tokenKeypair.publicKey, null, 9);
            feePayerTokenAccount = await getOrCreateAssociatedTokenAccount(
                connection,
                feePayerKeypair,
                mint,
                feePayerKeypair.publicKey
            );
            baseAllowedTokens = [
                new TokenFee(mint, feePayerTokenAccount.address, 9, BigInt(100)),
            ];
        });

        let sourceOwner: Keypair;
        let sourceAccount: PublicKey;
        let recentBlockhash = '';
        beforeEach(async () => {
            // We shouldn't airdrop any SOL to this keypair
            sourceOwner = Keypair.generate();
            sourceAccount = await createAccount(connection, feePayerKeypair, mint, sourceOwner.publicKey);

            await mintTo(connection, tokenKeypair, mint, sourceAccount, tokenKeypair.publicKey, 5000);

            recentBlockhash = (await connection.getRecentBlockhash()).blockhash;
        });

        it('signs a transaction with initialization fees and token transfer to a previously not used associated token account', async () => {
            const targetOwner = Keypair.generate();
            const targetAccountAddress = await getAssociatedTokenAddress(mint, targetOwner.publicKey, false);

            // We first have to create an associated account for target owner
            const accountTransaction = new Transaction();
            accountTransaction.add(
                createTransferInstruction(sourceAccount, feePayerTokenAccount.address, sourceOwner.publicKey, 100)
            );
            accountTransaction.add(
                createAssociatedTokenAccountInstruction(
                    // We are using Octane's public key, since the initialization fees have to be paid in SOL
                    // and our hypothetical user doesn't have any SOL.
                    feePayerKeypair.publicKey,
                    targetAccountAddress,
                    targetOwner.publicKey,
                    mint
                )
            );
            accountTransaction.feePayer = feePayerKeypair.publicKey;
            accountTransaction.recentBlockhash = recentBlockhash;
            accountTransaction.partialSign(sourceOwner);

            await expect(getAccount(connection, targetAccountAddress, 'confirmed')).to.be.rejected;

            const { signature } = await createAccountIfTokenFeePaid(
                connection,
                accountTransaction,
                feePayerKeypair,
                2,
                5000,
                baseAllowedTokens,
                cache
            );
            expect(signature).to.not.be.empty;
            accountTransaction.addSignature(feePayerKeypair.publicKey, base58.decode(signature));
            await sendAndConfirmRawTransaction(connection, accountTransaction.serialize(), { commitment: 'confirmed' });
            expect((await connection.getSignatureStatus(signature)).value!.confirmationStatus).to.be.equals(
                'confirmed'
            );
            expect((await getAccount(connection, targetAccountAddress, 'confirmed')).isInitialized).to.be.true;
            expect((await getAccount(connection, feePayerTokenAccount.address, 'confirmed')).amount).to.equal(
                BigInt(100)
            );
        });

        it('rejects a transaction with previously created account', async () => {
            const targetOwner = Keypair.generate();
            const targetAccount = await createAccount(connection, feePayerKeypair, mint, targetOwner.publicKey);

            // We first have to create an associated account for target owner
            const accountTransaction = new Transaction();
            accountTransaction.add(
                createTransferInstruction(sourceAccount, feePayerTokenAccount.address, sourceOwner.publicKey, 100)
            );
            accountTransaction.add(
                createAssociatedTokenAccountInstruction(
                    // We are using Octane's public key, since the initialization fees have to be paid in SOL
                    // and our hypothetical user doesn't have any SOL.
                    feePayerKeypair.publicKey,
                    targetAccount,
                    targetOwner.publicKey,
                    mint
                )
            );
            accountTransaction.feePayer = feePayerKeypair.publicKey;
            accountTransaction.recentBlockhash = recentBlockhash;
            accountTransaction.partialSign(sourceOwner);

            await expect(
                createAccountIfTokenFeePaid(
                    connection,
                    accountTransaction,
                    feePayerKeypair,
                    2,
                    5000,
                    baseAllowedTokens,
                    cache
                )
            ).to.be.rejectedWith('account already exists');
        });

        // todo: cover more errors while signing memory transaction.
    });
}
