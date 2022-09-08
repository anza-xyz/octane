import { expect } from 'chai';
import base58 from 'bs58';
// @ts-ignore (TS7016) There is no type definition for this at DefinitelyTyped.
import MemoryStore from 'cache-manager/lib/stores/memory';
import cacheManager from 'cache-manager';
import {
    Keypair,
    Connection,
    Transaction,
    sendAndConfirmRawTransaction, SystemProgram,
} from '@solana/web3.js';
import { signGeneratedTransaction } from '../../src';
import { airdropLamports } from '../common';
import { MessageToken } from '../../src/core';

const connection = new Connection('http://localhost:8899/', 'confirmed');

const feePayer = Keypair.generate();
before(async () => {
    await airdropLamports(connection, feePayer.publicKey);
});

let cache: cacheManager.Cache;
let user: Keypair;
beforeEach(async () => {
    cache = cacheManager.caching({ store: MemoryStore, max: 1000, ttl: 120 });
    user = Keypair.generate();
    await airdropLamports(connection, user.publicKey);
})

if (process.env.TEST_LIVE) {
    describe('signGeneratedTransaction action', async () => {
        it('signs a transaction with correct message token', async () => {
            const transaction = new Transaction({
                feePayer: feePayer.publicKey,
                ...(await connection.getLatestBlockhash()),
            }).add(SystemProgram.transfer({
                fromPubkey: user.publicKey,
                lamports: 100,
                toPubkey: feePayer.publicKey
            }));
            const messageToken = new MessageToken(
                'test-transaction',
                transaction.compileMessage(),
                feePayer
            ).compile();
            transaction.partialSign(user);
            expect(transaction.signatures[0].publicKey.equals(feePayer.publicKey)).to.be.true;
            expect(transaction.signatures[0].signature).to.be.null;
            expect(transaction.signatures[1].publicKey.equals(user.publicKey)).to.be.true;
            expect(transaction.signatures[1].signature).to.not.be.null;

            const { signature } = await signGeneratedTransaction(
                connection,
                transaction,
                feePayer,
                'test-transaction',
                messageToken,
                cache,
            );
            transaction.addSignature(feePayer.publicKey, base58.decode(signature));
            expect(transaction.signatures[0].signature).to.not.be.null;
            transaction.serialize();
            await sendAndConfirmRawTransaction(
                connection,
                transaction.serialize(),
                {commitment: 'confirmed' }
            );
        });

        it('rejects a transaction with additional instruction', async () => {
            const transaction = new Transaction({
                feePayer: feePayer.publicKey,
                ...(await connection.getLatestBlockhash()),
            }).add(SystemProgram.transfer({
                fromPubkey: user.publicKey,
                lamports: 100,
                toPubkey: feePayer.publicKey
            }));
            const messageToken = new MessageToken(
                'test-transaction',
                transaction.compileMessage(),
                feePayer
            ).compile();
            transaction.add(SystemProgram.transfer({
                fromPubkey: user.publicKey,
                lamports: 50,
                toPubkey: feePayer.publicKey
            }));
            transaction.partialSign(user);
            await expect(signGeneratedTransaction(
                connection,
                transaction,
                feePayer,
                'test-transaction',
                messageToken,
                cache,
            )).to.be.rejectedWith('Message token isn\'t valid');
        });

        it('rejects a duplicate transaction', async () => {
            const transaction = new Transaction({
                feePayer: feePayer.publicKey,
                ...(await connection.getLatestBlockhash()),
            }).add(SystemProgram.transfer({
                fromPubkey: user.publicKey,
                lamports: 100,
                toPubkey: feePayer.publicKey
            }));
            const messageToken = new MessageToken(
                'test-transaction',
                transaction.compileMessage(),
                feePayer
            ).compile();
            transaction.partialSign(user);

            await signGeneratedTransaction(
                connection,
                transaction,
                feePayer,
                'test-transaction',
                messageToken,
                cache,
            );
            await expect(signGeneratedTransaction(
                connection,
                transaction,
                feePayer,
                'test-transaction',
                messageToken,
                cache,
            )).to.be.rejectedWith('Duplicate signature request');
        });

        it('rejects a transaction when fee payer\'s signature isn\'t required', async () => {
            const transaction = new Transaction({
                feePayer: user.publicKey,
                ...(await connection.getLatestBlockhash()),
            }).add(SystemProgram.transfer({
                fromPubkey: user.publicKey,
                lamports: 100,
                toPubkey: feePayer.publicKey
            }));
            const messageToken = new MessageToken(
                'test-transaction',
                transaction.compileMessage(),
                feePayer
            ).compile();
            transaction.partialSign(user);
            await expect(signGeneratedTransaction(
                connection,
                transaction,
                feePayer,
                'test-transaction',
                messageToken,
                cache,
            )).to.be.rejectedWith('Transaction should have at least 2 pubkeys as signers');
        });

        it('rejects a unsigned by user transaction', async () => {
            const transaction = new Transaction({
                feePayer: feePayer.publicKey,
                ...(await connection.getLatestBlockhash()),
            }).add(SystemProgram.transfer({
                fromPubkey: user.publicKey,
                lamports: 100,
                toPubkey: feePayer.publicKey
            }));
            const messageToken = new MessageToken(
                'test-transaction',
                transaction.compileMessage(),
                feePayer
            ).compile();
            await expect(signGeneratedTransaction(
                connection,
                transaction,
                feePayer,
                'test-transaction',
                messageToken,
                cache,
            )).to.be.rejectedWith('Transaction should have at least 2 pubkeys as signers');
        });

        it('rejects a transaction that will fail', async () => {
            const transaction = new Transaction({
                feePayer: feePayer.publicKey,
                ...(await connection.getLatestBlockhash()),
            }).add(SystemProgram.transfer({
                fromPubkey: user.publicKey,
                lamports: await connection.getBalance(user.publicKey) + 1,
                toPubkey: feePayer.publicKey
            }));
            const messageToken = new MessageToken(
                'test-transaction',
                transaction.compileMessage(),
                feePayer
            ).compile();
            transaction.partialSign(user);
            await expect(signGeneratedTransaction(
                connection,
                transaction,
                feePayer,
                'test-transaction',
                messageToken,
                cache,
            )).to.be.rejectedWith('Simulation error');
        });
    });
}
