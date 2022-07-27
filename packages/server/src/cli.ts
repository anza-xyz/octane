import { Command } from 'commander';
import { LAMPORTS_PER_SOL, PublicKey, Transaction } from '@solana/web3.js';
import {
    createAssociatedTokenAccount,
    getAccount,
    getAssociatedTokenAddress,
    getMinimumBalanceForRentExemptAccount,
} from '@solana/spl-token';
import axios from 'axios';
import { connection, ENV_SECRET_KEYPAIR, getLamportsPerSignature,
    loadPopularTokensFromJupiter, createTokenConfigEntries } from './index';
import config from '../../../config.json';

const MAINNET_BETA_GENESIS_HASH = '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d';

const program = new Command();

program
    .command('create-config-with-popular-tokens')
    .option(
        '-t, --tokens-from-top <number>',
        'Tokens from the top of Jupiter aggregator to include',
        '10'
    )
    .option(
        '-m, --margin <number>',
        'Part of total user-paid fee that fee payers takes as a surplus to transaction costs. ' +
        'From 0 to 1. For example, 0.5 would mean that user pays 2x the SOL signature fee and 0.9 would mean that user pays 10x the fee.',
        '0.9'
    )
    .option(
        '-a, --include-account-fees',
        'Includes creating a associated token account in each fee. Use this flag when filling out the endpoints.createAccount part of config.',
        ''
    )
    .addHelpText(
        'beforeAll',
        'Loads popular tokens from Jupiter aggregator, calculates fees and outputs token entries to put in config'
    )
    .action(async ({tokensFromTop, margin, includeAccountFees}) => {
        if ((await connection.getGenesisHash()) != MAINNET_BETA_GENESIS_HASH) {
            console.log('CLI is designed to work only with mainnet-beta cluster. Change "rpcUrl" in config.json.')
            return;
        }

        const popularTokenMints = await loadPopularTokensFromJupiter(tokensFromTop);
        const lamportsPerSignature = await getLamportsPerSignature(connection);

        let cost: number;
        if (includeAccountFees) {
            cost = lamportsPerSignature + await getMinimumBalanceForRentExemptAccount(connection);
        } else {
            cost = lamportsPerSignature;
        }

        console.log(`lamportsPerSignature: ${lamportsPerSignature}`);
        console.log(JSON.stringify(await createTokenConfigEntries(
            connection,
            ENV_SECRET_KEYPAIR.publicKey,
            popularTokenMints,
            cost,
            margin,
        ), undefined, 4));
    });

program
    .command('create-accounts')
    .option(
        '-d, --dry-run',
        'Outputs accounts to be created',
        ''
    )
    .addHelpText('beforeAll', 'Creates fee collection accounts for fees listed in config')
    .action(async ({ dryRun }) => {
        const tokensWithAccountsToCreate = await Promise.all(
            config.endpoints.transfer.tokens
                .map(async tokenEntry => {
                    // only not created already counts
                    const accountInfo = await connection.getAccountInfo(new PublicKey(tokenEntry.account));
                    if (accountInfo) {
                        return null;
                    }

                    // it should be associated token address for the owner
                    const associatedTokenAddress = await getAssociatedTokenAddress(
                        new PublicKey(tokenEntry.mint),
                        ENV_SECRET_KEYPAIR.publicKey
                    );
                    if (!(new PublicKey(tokenEntry.account).equals(associatedTokenAddress))) {
                        return null;
                    }
                    return tokenEntry;
                })
        );

        console.log('tokens with accounts to create:', tokensWithAccountsToCreate);

        if (!dryRun) {
            for (const tokenEntry of tokensWithAccountsToCreate) {
                if (tokenEntry === null) {
                    continue;
                }
                try {
                    await createAssociatedTokenAccount(
                        connection,
                        ENV_SECRET_KEYPAIR,
                        new PublicKey(tokenEntry.mint),
                        ENV_SECRET_KEYPAIR.publicKey,
                    );
                } catch (e) {
                    console.log(e);
                    break;
                }
            }
        }
    });

program
    .command('swap-tokens-to-sol')
    .option(
        '-d, --dry-run',
        'Outputs accounts to be created',
        ''
    )
    .option(
        '-t, --threshold <number>',
        'Minimum value of tokens to exchange, in SOL lamports',
        '100000000'
    )
    .action(async ({ dryRun, threshold }) => {
        const accountStates = await Promise.all(config.endpoints.transfer.tokens.map(async tokenEntry => {
            console.log(tokenEntry.account, await getAccount(connection, new PublicKey(tokenEntry.account)));
            return {
                account: tokenEntry.account,
                mint: tokenEntry.mint,
                amount: (await getAccount(connection, new PublicKey(tokenEntry.account))).amount,
            }
        }));

        for (const accountState of accountStates) {
            if (accountState.amount === 0n) {
                continue;
            }

            const routes = (await axios.get('https://quote-api.jup.ag/v1/quote', {
                params: {
                    inputMint: accountState.mint,
                    outputMint: 'So11111111111111111111111111111111111111112',
                    amount: accountState.amount,
                    slippage: 0.5,
                }
            })).data.data;
            const route = routes[0];

            if (route.outAmount < threshold) {
                console.log(`Skipping token ${accountState.mint}: not enough value to exchange.`);
                continue;
            }

            console.log(`Selling token ${accountState.mint} for ${route.outAmount / LAMPORTS_PER_SOL} SOL`);

            if (!dryRun) {
                const transactions = (
                    await axios.post('https://quote-api.jup.ag/v1/swap', {
                        route,
                        userPublicKey: ENV_SECRET_KEYPAIR.publicKey.toString(),
                        wrapUnwrapSOL: true,
                    },{
                        headers: { 'Content-Type': 'application/json' }
                    })
                ).data;
                const { setupTransaction, swapTransaction, cleanupTransaction } = transactions;

                for (let serializedTransaction of [setupTransaction, swapTransaction, cleanupTransaction].filter(Boolean)) {
                    const transaction = Transaction.from(Buffer.from(serializedTransaction, 'base64'));
                    const txid = await connection.sendTransaction(transaction, [ENV_SECRET_KEYPAIR], {
                        skipPreflight: true
                    });
                    await connection.confirmTransaction(txid);
                    console.log(`https://solscan.io/tx/${txid}`);
                }
            }
        }
    });

program.parse();
