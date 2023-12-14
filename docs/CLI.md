# Command-line tools

You can launch command-line tools from your Octane server directory. You can learn how to set it up in [SETUP](SETUP.md).

## Generating config with popular tokens

`yarn run cli generate-config-with-popular-tokens `

Generates JSON to put in `config.json` as token fees for a specific endpoint. It loads popular tokens from Jupiter aggregator, calculates fees according to arguments and selects accounts to receive fees.

Config should be generated for each endpoint separately — in most cases, with different arguments.

Endpoints like `transfer` and `buildWhirlpoolSwap` require less SOL, so margins could be higher. Endpoint `createAssociatedTokenAccount`, that charges fee payer for a rent exemption payment on a new token account, must include `--include-account-fees` and may use lower margins, since the original price would be much higher.

```
{
    "rpcUrl": "https://api.mainnet-beta.solana.com",
    "maxSignatures": 2,
    "lamportsPerSignature": 5000,
    "corsOrigin": true,
    "endpoints": {
        "transfer": {
            "tokens": [
                // [ Result #1, yarn run cli generate-config-with-popular-tokens ]
            ]
        },
        "whirlpoolSwap": {
            "tokens": [
                // [ Result #2, yarn run cli generate-config-with-popular-tokens --n 5 ]
            ]
        }
        "createAssociatedTokenAccount": {
            "tokens": [
                // [ Result #3, yarn run cli generate-config-with-popular-tokens --include-account-fees ]
            ]
        }
    }
}
````


| Argument                       | Description                                                                                                                                                            | Default value |
|--------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------|---------------|
| -t, --tokens-from-top <number> | Tokens from the top of Jupiter aggregator to include                                                                                                                   | 10            |
| -m, --margin <number>          | Part of total user-paid fee that fee payers take as a surplus to transaction costs. From 0 to 1. For example, 0.5 would mean that user pays 2x the SOL signature fee. | 0.9           |
| -a, --include-account-fees     | Includes cost creating an associated token account in each fee pre-margin. Use this flag when filling out the endpoints.createAssociatedAccount part of config.         |               |

## Generating a config entry

`yarn run cli generate-config-entry`

Generates a config entry for a single provided token. All rules of `generate-config-with-popular-tokens` apply here as well.

| Argument                       | Description                                                                                                                                                            | Default value |
|--------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------|---------------|
| -m, --margin <number>          | Part of total user-paid fee that fee payers take as a surplus to transaction costs. From 0 to 1. For example, 0.5 would mean that user pays 2x the SOL signature fee. | 0.9           |
| -a, --include-account-fees     | Includes cost creating an associated token account in each fee pre-margin. Use this flag when filling out the endpoints.createAssociatedAccount part of config.         |               |


## Swapping tokens

`yarn run cli swap-tokens-to-sol`

Swaps tokens on accounts in `config.json` to SOL using Jupiter aggregator HTTP API.

It's recommended to run this command automatically every few hours to make sure fee payer always has enough SOL.

| Argument                 | Description                                          | Default value |
|--------------------------|------------------------------------------------------|---------------|
| -d, --dry-run            | Do not execute swaps, just calculate routes          |               |
| -t, --threshold <number> | Minimum value of tokens to exchange, in SOL lamports | 100000000     |



## Create accounts

`yarn run cli create-accounts`

Creates associated token accounts for tokens specified in `config.json`. Octane will need these accounts to receive fee payments
from users.

| Argument                 | Description                                                | Default value |
|--------------------------|------------------------------------------------------------|---------------|
| -d, --dry-run            | Do not create accounts, just output what should be created |               |


