import { Command } from 'commander';
import { PublicKey } from '@solana/web3.js';
import {
    getMinimumBalanceForRentExemptAccount,
} from '@solana/spl-token';
import { PayerUtils, core } from '@solana/octane-core';
import { connection, ENV_SECRET_KEYPAIR } from './index';
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

        const popularTokenMints = await PayerUtils.getPopularTokens(tokensFromTop);
        const lamportsPerSignature = await PayerUtils.getLamportsPerSignature(connection);

        let cost: number;
        if (includeAccountFees) {
            cost = lamportsPerSignature + await getMinimumBalanceForRentExemptAccount(connection);
        } else {
            cost = lamportsPerSignature;
        }

        const tokensWithPriceInfo = await Promise.all(popularTokenMints.map(async mint => ({
            mint: mint,
            priceInfo: await PayerUtils.getTokenToNativePriceInfo(mint)
        })));
        const pricingParams = {
            costInLamports: cost,
            margin: margin,
        };

        const tokenFees = await PayerUtils.buildTokenFeeList(
            connection,
            ENV_SECRET_KEYPAIR.publicKey,
            tokensWithPriceInfo,
            pricingParams,
        );

        console.log(`lamportsPerSignature: ${lamportsPerSignature}`);
        console.log(JSON.stringify(tokenFees.map(tokenFee => tokenFee.toSerializable())));
    });

program
    .command('generate-config-for-token')
    .argument('<mint>')
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
    .action(async (mintAsString, {margin, includeAccountFees}) => {
        const mint = new PublicKey(mintAsString);
        const lamportsPerSignature = await PayerUtils.getLamportsPerSignature(connection);

        let cost: number;
        if (includeAccountFees) {
            cost = lamportsPerSignature + await getMinimumBalanceForRentExemptAccount(connection);
        } else {
            cost = lamportsPerSignature;
        }

        const priceInfo = await PayerUtils.getTokenToNativePriceInfo(mint);
        const pricingParams = {
            costInLamports: cost,
            margin: margin,
        };

        const tokenFee = (await PayerUtils.buildTokenFeeList(
            connection,
            ENV_SECRET_KEYPAIR.publicKey,
            [{ mint, priceInfo }],
            pricingParams,
        ))[0];

        console.log(`lamportsPerSignature: ${lamportsPerSignature}`);
        console.log(JSON.stringify(tokenFee.toSerializable()));
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
        const createAccounts = await PayerUtils.buildCreateAccountListFromTokenFees(
            connection,
            ENV_SECRET_KEYPAIR.publicKey,
            config.endpoints.transfer.tokens.map((tokenFee) => core.TokenFee.fromSerializable(tokenFee))
        );

        console.log('accounts to create:', createAccounts);

        if (!dryRun) {
            const result = await PayerUtils.createAccounts(connection, ENV_SECRET_KEYPAIR, createAccounts);
            const errors = result.filter(value => value.error !== null);
            if (errors) {
                console.log('create results with errors:', errors);
            }
        }
    });

program
    .command('swap-tokens-to-sol')
    .option(
        '-d, --dry-run',
        'Outputs swap transactions to be executed',
        ''
    )
    .option(
        '-t, --threshold <number>',
        'Minimum value of tokens to exchange, in SOL lamports',
        '100000000'
    )
    .action(async ({ dryRun, threshold }) => {
        const routesToSwap = await PayerUtils.loadSwapRoutesForTokenFees(
            connection,
            config.endpoints.transfer.tokens.map(token => core.TokenFee.fromSerializable(token)),
            parseInt(threshold),
            0.5
        );

        if (!routesToSwap) {
            console.log('No tokens to swap');
        }

        console.log('Tokens to swap:', routesToSwap);

        if (!dryRun) {
            for (const route of routesToSwap) {
                const txids = await PayerUtils.executeSwapByRoute(connection, ENV_SECRET_KEYPAIR, route);
                console.log(`Executed transactions:`, txids);
            }
        }
    });

program.parse();
