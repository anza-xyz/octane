# Endpoints

### Get node configuration

`GET /api/`

Load Octane node configuration. Config is used to correctly set token fee and fee payer in the created transaction.

No parameters.

Example response:

```json
{
    "feePayer": "AmnCNDKh74yWiyAtA3gn6tBBdyU7qzdxYkeXhZRqMNZm",
    "rpcUrl": "https://api.mainnet-beta.solana.com",
    "maxSignatures": 2,
    "lamportsPerSignature": 5000,
    "corsOrigin": true,
    "endpoints": {
        "transfer": {
            "tokens": [
                {
                    "mint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
                    "account": "Ar9LjjzJoAhqVQ5xjtAqRhRLtanzYPT72bBv2MZ8ggA1",
                    "decimals": 6,
                    "fee": 1553
                }
            ]
        },
        "createAssociatedTokenAccount": {
            "tokens": [
                {
                    "mint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
                    "account": "Ar9LjjzJoAhqVQ5xjtAqRhRLtanzYPT72bBv2MZ8ggA1",
                    "decimals": 6,
                    "fee": 127014
                }
            ]
        },
        "whirlpoolsSwap": {
            "tokens": [
                {
                    "mint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
                    "account": "Ar9LjjzJoAhqVQ5xjtAqRhRLtanzYPT72bBv2MZ8ggA1",
                    "decimals": 6,
                    "fee": 1553
                }
            ]
        }
    }
}
```

[Source code](https://github.com/solana-labs/octane/blob/master/packages/server/pages/api/index.ts)

### Create a new associated token account

`POST /api/createAssociatedTokenAccount`

The transaction should transfer a fee to Octane as first instruction and create new associated token account as second instruction.

| Parameter   | Type   | Description                                                 |
|-------------|--------|-------------------------------------------------------------|
| transaction | String | Base58-encoded serialized transaction with user's signature |

Example response:
```json
{
   "status": "ok",
   "signature": "LSYkHUMUuPCmnScxtbqPrBiy8Eiw28NHvwRzbRRix2v8jon8RKMNYkqxH23E9Mabks985AKeR5293ekQzLoTGBT"
}
```

[Source code](https://github.com/solana-labs/octane/blob/master/packages/server/pages/api/createAssociatedTokenAccount.ts)

### Submit an arbitrary transaction

`POST /api/transfer`

Submit an arbitrary transaction. First instruction should transfer a fee to Octane. Transaction can't create new accounts: use `/createAssociatedTokenAccount` for Token Program and just-in-time swaps for other programs.

| Parameter   | Type   | Description                                                 |
|-------------|--------|-------------------------------------------------------------|
| transaction | String | Base58-encoded serialized transaction with user's signature |

Example response:
```json
{
   "status": "ok",
   "signature": "LSYkHUMUuPCmnScxtbqPrBiy8Eiw28NHvwRzbRRix2v8jon8RKMNYkqxH23E9Mabks985AKeR5293ekQzLoTGBT"
}
```

[Source code](https://github.com/solana-labs/octane/blob/master/packages/server/pages/api/transfer.ts)

### Build a Whirlpools swap transaction

`POST /api/buildWhirlpoolsSwap`

Creates a transaction that allows to exchange an SPL token to SOL without having any SOL. It also returns `messageToken`: it needs to be passed to `/sendWhirlpoolsSwap` when submitting the signed transaction.

| Parameter         | Type   | Description                                              |
|-------------------|--------|----------------------------------------------------------|
| user              | String | Base58-encoded public key of user who wants to make swap |
| sourceMint        | String | Base58-encoded mint of source SPL token                  |
| amount            | Number | Amount of source token to swap, in decimals notation     |
| slippingTolerance | Number | Slipping tolerance for swap                              |


Example response:
```json
{
    "status": "ok",
    "transaction": "[...]",
    "messageToken": "[...]",
    "quote": {}
}
```

[Source code](https://github.com/solana-labs/octane/blob/master/packages/server/pages/api/buildWhirlpoolsSwap.ts)

### Send a Whirlpools swap transaction

`POST /api/sendWhirlpoolsSwap`

Sends a swap transaction after it was signed by the user.

| Parameter    | Type   | Description                                                 |
|--------------|--------|-------------------------------------------------------------|
| transaction  | String | Base58-encoded serialized transaction with user's signature |
| messageToken | String | Message token from `/buildWhirlpoolsSwap` result            |

[Source code](https://github.com/solana-labs/octane/blob/master/packages/server/pages/api/sendWhirlpoolsSwap.ts)
