import { expect } from 'chai';
import BN from 'bn.js';
// @ts-ignore (TS7016) There is no type definition for this at DefinitelyTyped.
import MemoryStore from 'cache-manager/lib/stores/memory';
import cacheManager from 'cache-manager';
import { Keypair, PublicKey, Connection, } from '@solana/web3.js';
import { buildWhirlpoolsSwapToSOL } from '../../src';
import { Percentage } from '@orca-so/common-sdk';
import { sign } from 'tweetnacl';
import { getAssociatedTokenAddress, getAccount, TOKEN_PROGRAM_ID, } from '@solana/spl-token';

const connection = new Connection('https://api.mainnet-beta.solana.com/', 'confirmed');

const _keypair = sign.keyPair();
// @ts-ignore: _keypair should be private
const feePayerStub: Keypair = {
    _keypair,
    secretKey: (new Keypair(_keypair)).secretKey,
    publicKey: new PublicKey('AmnCNDKh74yWiyAtA3gn6tBBdyU7qzdxYkeXhZRqMNZm') // public key with some SOL on mainnet
};

const mintUSDC = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
const userWithUSDC = new PublicKey('EmMC1F6X25qsnXVzNzKUyqFWfLF2GsVJW55fGJRm9feY'); // a keypair with 0.1 USDC

let cache: cacheManager.Cache;
beforeEach(async () => {
    cache = cacheManager.caching({ store: MemoryStore, max: 1000, ttl: 120 });
})

describe('buildWhirlpoolsSwapToSOL action', async () => {
    it('creates a signed transaction with USDC without fee', async () => {
        const {transaction, quote} = await buildWhirlpoolsSwapToSOL(
            connection,
            feePayerStub,
            userWithUSDC,
            mintUSDC,
            new BN(50000),
            Percentage.fromFraction(1, 1000),
            cache,
        );

        expect(transaction.feePayer!.equals(feePayerStub.publicKey)).to.be.true;
        expect(transaction.signatures[0].publicKey.equals(feePayerStub.publicKey)).to.be.true;
        expect(transaction.signatures[0].signature).to.be.null;
        expect(transaction.signatures[1].publicKey.equals(userWithUSDC)).to.be.true;
        expect(transaction.signatures[1].signature).to.be.null;

        await expect(quote.estimatedAmountIn.toNumber()).to.equal((new BN(50000).toNumber()));
        await expect(quote.estimatedAmountOut.toNumber()).to.be.greaterThan(0);
    });

    it('rejects a transaction when amount of swap is more than token balance', async () => {
        await expect(buildWhirlpoolsSwapToSOL(
            connection,
            feePayerStub,
            userWithUSDC,
            mintUSDC,
            new BN(100000000),
            Percentage.fromFraction(1, 1000),
            cache,
        )).to.be.rejectedWith('Simulation error');
    });

    it('rejects when using mint that does not exist', async () => {
        const user = Keypair.generate();
        const sourceMint = Keypair.generate().publicKey;
        await expect( buildWhirlpoolsSwapToSOL(
            connection,
            feePayerStub,
            user.publicKey,
            sourceMint,
            new BN(1000000),
            Percentage.fromFraction(1, 1000),
            cache,
        )).to.be.rejectedWith('Unable to fetch Whirlpool');
    });

    it('rejects when amount is less than zero', async () => {
        await expect( buildWhirlpoolsSwapToSOL(
            connection,
            feePayerStub,
            userWithUSDC,
            mintUSDC,
            new BN(-1),
            Percentage.fromFraction(1, 1000),
            cache,
        )).to.be.rejectedWith('Amount can\'t be zero or less');
    });

    it('rejects a transaction if another transaction with same mint and user was signed recently', async () => {
        await buildWhirlpoolsSwapToSOL(
            connection,
            feePayerStub,
            userWithUSDC,
            mintUSDC,
            new BN(50000),
            Percentage.fromFraction(1, 1000),
            cache,
            1000
        );
        await expect( buildWhirlpoolsSwapToSOL(
            connection,
            feePayerStub,
            userWithUSDC,
            mintUSDC,
            new BN(50000),
            Percentage.fromFraction(1, 1000),
            cache,
            1000
        )).to.be.rejectedWith('Too many requests for same user and mint');
    });

    it('rejects a transaction when connection is attached to a non-mainnet cluster', async () => {
        const connectionDevnet = new Connection('https://api.devnet.solana.com/', 'confirmed');
        await expect( buildWhirlpoolsSwapToSOL(
            connectionDevnet,
            feePayerStub,
            userWithUSDC,
            mintUSDC,
            new BN(100),
            Percentage.fromFraction(1, 1000),
            cache,
        )).to.be.rejectedWith('Whirlpools endpoint can only run attached to the mainnet-beta cluster');

        // Check that cache was updated:
        expect(await cache.get<string>(`genesis/${connectionDevnet.rpcEndpoint}`)).to.equal(await connectionDevnet.getGenesisHash());

        // Check that cache is scoped locally to the connection. The query with original connection shouldn't fail:
        await buildWhirlpoolsSwapToSOL(
            connection,
            feePayerStub,
            userWithUSDC,
            mintUSDC,
            new BN(50000),
            Percentage.fromFraction(1, 1000),
            cache,
            1000
        );

        // Tamper with cache and check that it reflects on result:
        await expect( buildWhirlpoolsSwapToSOL(
            connectionDevnet,
            feePayerStub,
            userWithUSDC,
            mintUSDC,
            new BN(-1),
            Percentage.fromFraction(1, 1000),
            cache,
        )).to.be.rejectedWith('Whirlpools endpoint can only run attached to the mainnet-beta cluster');
        await cache.set<string>(`genesis/${connectionDevnet.rpcEndpoint}`, await connection.getGenesisHash());
        await expect(buildWhirlpoolsSwapToSOL(
            connectionDevnet,
            feePayerStub,
            userWithUSDC,
            mintUSDC,
            new BN(-1),
            Percentage.fromFraction(1, 1000),
            cache,
            0
        )).to.be.rejectedWith('Amount can\'t be zero or less'); // next check after cluster
    });

    it('creates a signed transaction with USDC with fee in USDC', async () => {
        const {transaction, quote} = await buildWhirlpoolsSwapToSOL(
            connection,
            feePayerStub,
            userWithUSDC,
            mintUSDC,
            new BN(50000),
            Percentage.fromFraction(1, 1000),
            cache,
            3000,
            {
                amount: 5,
                destinationAccount: await getAssociatedTokenAddress(mintUSDC, feePayerStub.publicKey),
                sourceAccount: await getAssociatedTokenAddress(mintUSDC, userWithUSDC),
            }
        );

        expect(transaction.feePayer!.equals(feePayerStub.publicKey)).to.be.true;

        expect(transaction.signatures[0].publicKey.equals(feePayerStub.publicKey)).to.be.true;
        expect(transaction.signatures[0].signature).to.be.null;
        expect(transaction.signatures[1].publicKey.equals(userWithUSDC)).to.be.true;
        expect(transaction.signatures[1].signature).to.be.null;

        expect(transaction.instructions[0].programId.equals(TOKEN_PROGRAM_ID)).to.be.true;
        expect(
            transaction.instructions[0].keys[0].pubkey
                .equals(await getAssociatedTokenAddress(mintUSDC, userWithUSDC))
        ).to.be.true;
        expect(
            transaction.instructions[0].keys[1].pubkey
                .equals(await getAssociatedTokenAddress(mintUSDC, feePayerStub.publicKey))
        ).to.be.true;

        await expect(quote.estimatedAmountIn.toNumber()).to.equal((new BN(50000).toNumber()));
        await expect(quote.estimatedAmountOut.toNumber()).to.be.greaterThan(0);
        await expect(transaction.feePayer!.equals(feePayerStub.publicKey)).to.be.true;
    });

    it('rejects when fee and swap amount exceed balance', async () => {
        const balance = new BN(
            (await getAccount(
                connection,
                await getAssociatedTokenAddress(mintUSDC, userWithUSDC)
            )).amount.toString()
        );

        await buildWhirlpoolsSwapToSOL(
            connection,
            feePayerStub,
            userWithUSDC,
            mintUSDC,
            balance,
            Percentage.fromFraction(1, 1000),
            cache,
            0
        );

        await expect(buildWhirlpoolsSwapToSOL(
            connection,
            feePayerStub,
            userWithUSDC,
            mintUSDC,
            balance,
            Percentage.fromFraction(1, 1000),
            cache,
            0,
            {
                amount: 5,
                destinationAccount: await getAssociatedTokenAddress(mintUSDC, feePayerStub.publicKey),
                sourceAccount: await getAssociatedTokenAddress(mintUSDC, userWithUSDC),
            }
        )).to.be.rejectedWith('Simulation error');
    });

    it('rejects when fee\'s destination and source have different mints', async () => {
        const mint = new PublicKey('Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'); // USDT
        await expect(buildWhirlpoolsSwapToSOL(
            connection,
            feePayerStub,
            userWithUSDC,
            mintUSDC,
            new BN(5),
            Percentage.fromFraction(1, 1000),
            cache,
            0,
            {
                amount: 5,
                destinationAccount: await getAssociatedTokenAddress(mint, feePayerStub.publicKey),
                sourceAccount: await getAssociatedTokenAddress(mintUSDC, userWithUSDC),
            }
        )).to.be.rejectedWith('Simulation error');
    });

    it('rejects when user already has associated SOL account', async () => {
        const user = new PublicKey('9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM'); // Has unclosed wSOL account
        await expect(buildWhirlpoolsSwapToSOL(
            connection,
            feePayerStub,
            user,
            mintUSDC,
            new BN(5),
            Percentage.fromFraction(1, 1000),
            cache,
            0,
            {
                amount: 5,
                destinationAccount: await getAssociatedTokenAddress(mintUSDC, feePayerStub.publicKey),
                sourceAccount: await getAssociatedTokenAddress(mintUSDC, userWithUSDC),
            }
        )).to.be.rejectedWith('Associated SOL account exists for user');
    });

    // todo: validate transaction simulation results
});
