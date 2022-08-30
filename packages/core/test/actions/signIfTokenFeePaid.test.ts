import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import base58 from 'bs58';
// @ts-ignore (TS7016) There is no type definition for this at DefinitelyTyped.
import MemoryStore from 'cache-manager/lib/stores/memory';
import cacheManager from 'cache-manager';
import { Keypair, PublicKey, Connection, Transaction, sendAndConfirmRawTransaction } from '@solana/web3.js';
import {
    createMint,
    getOrCreateAssociatedTokenAccount,
    Account,
    mintTo,
    createTransferInstruction,
    createAccount,
    getAccount,
} from '@solana/spl-token';
import { signWithTokenFee } from '../../src';
import { TokenFee } from '../../src/core';
import { airdropLamports, sleep } from '../common';

use(chaiAsPromised);

if (process.env.TEST_LIVE) {
    describe('signIfTokenFeePaid action', async () => {
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
                new TokenFee(mint, feePayerTokenAccount.address, 9, BigInt(100))
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

            recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
        });

        it('signs a transaction with token transfer to Octane payer and an arbitrary transfer successfully', async () => {
            const targetOwner = Keypair.generate();
            // We assume target account is already created.
            const targetAccount = await createAccount(connection, feePayerKeypair, mint, targetOwner.publicKey);

            const transaction = new Transaction();
            transaction.add(
                createTransferInstruction(sourceAccount, feePayerTokenAccount.address, sourceOwner.publicKey, 100)
            );
            transaction.add(createTransferInstruction(sourceAccount, targetAccount, sourceOwner.publicKey, 100));
            transaction.feePayer = feePayerKeypair.publicKey;
            transaction.recentBlockhash = recentBlockhash;
            transaction.partialSign(sourceOwner);

            const { signature } = await signWithTokenFee(
                connection,
                transaction,
                feePayerKeypair,
                2,
                5000,
                baseAllowedTokens,
                cache
            );
            expect(signature).to.not.be.empty;
            transaction.addSignature(feePayerKeypair.publicKey, base58.decode(signature));
            await sendAndConfirmRawTransaction(connection, transaction.serialize(), { commitment: 'confirmed' });

            expect((await connection.getSignatureStatus(signature)).value!.confirmationStatus).to.be.equals(
                'confirmed'
            );
            expect((await getAccount(connection, sourceAccount, 'confirmed')).amount).to.equal(BigInt(4800));
            expect((await getAccount(connection, feePayerTokenAccount.address, 'confirmed')).amount).to.equal(
                BigInt(100)
            );
            expect((await getAccount(connection, targetAccount, 'confirmed')).amount).to.equal(BigInt(100));
        });

        it('rejects a duplicate transaction', async () => {
            const transaction = new Transaction();
            transaction.add(
                createTransferInstruction(sourceAccount, feePayerTokenAccount.address, sourceOwner.publicKey, 100)
            );
            transaction.feePayer = feePayerKeypair.publicKey;
            transaction.recentBlockhash = recentBlockhash;
            transaction.partialSign(sourceOwner);
            const { signature } = await signWithTokenFee(
                connection,
                transaction,
                feePayerKeypair,
                2,
                5000,
                baseAllowedTokens,
                cache
            );
            expect(signature).to.not.be.empty;
            await expect(
                signWithTokenFee(connection, transaction, feePayerKeypair, 2, 5000, baseAllowedTokens, cache)
            ).to.be.rejectedWith('duplicate transaction');
        });

        // todo: actually simulate race condition
        it('rejects a transfer from the same account before timeout expires', async () => {
            const sameSourceTimeout = 500;
            // Make 3 transactions with different amounts to avoid 'duplicate transaction' error
            const transaction1 = new Transaction().add(
                createTransferInstruction(sourceAccount, feePayerTokenAccount.address, sourceOwner.publicKey, 100)
            );
            const transaction2 = new Transaction().add(
                createTransferInstruction(sourceAccount, feePayerTokenAccount.address, sourceOwner.publicKey, 101)
            );
            const transaction3 = new Transaction().add(
                createTransferInstruction(sourceAccount, feePayerTokenAccount.address, sourceOwner.publicKey, 102)
            );

            for (const transaction of [transaction1, transaction2, transaction3]) {
                transaction.feePayer = feePayerKeypair.publicKey;
                transaction.recentBlockhash = recentBlockhash;
                transaction.partialSign(sourceOwner);
            }

            const { signature: signature1 } = await signWithTokenFee(
                connection,
                transaction1,
                feePayerKeypair,
                2,
                5000,
                baseAllowedTokens,
                cache,
                sameSourceTimeout
            );
            expect(signature1).to.not.be.empty;
            await expect(
                signWithTokenFee(
                    connection,
                    transaction2,
                    feePayerKeypair,
                    2,
                    5000,
                    baseAllowedTokens,
                    cache,
                    sameSourceTimeout
                )
            ).to.be.rejectedWith('duplicate transfer');
            await sleep(sameSourceTimeout);
            const { signature: signature3 } = await signWithTokenFee(
                connection,
                transaction3,
                feePayerKeypair,
                2,
                5000,
                baseAllowedTokens,
                cache,
                sameSourceTimeout
            );
            expect(signature3).to.not.be.empty;
        });

        // todo: cover more errors
    });
}
