# Library

You can use Octane as a Node.js library for your backend application. You'll be able to use methods for transaction validation, signing and fee payer account management (for example, swapping token fees to SOL).

## Install

Currently, Octane isn't available on NPM. You can install it from the git repo using GitPkg:

```
yarn add 'https://gitpkg.now.sh/solana-labs/octane/packages/core?630a8d6afc90d2fe5aad88db2dc56c880cdbb5ad&scripts.postinstall=yarn%20install%20--ignore-scripts%20%26%26%20yarn%20run%20build'
```

## Methods

### Actions

Actions are self-contained transaction validation and signing endpoints.

You can call them from your backend endpoints when your use case fits in the Octane server capabilities:
* Paying for transactions with an SPL token fee (including if it's your own token)
* Paying for creating associated token accounts with an SPL token fee
* Paying for gasless swaps with an SPL Token fee or without fee

#### signWithTokenFee

Sign transaction by fee payer if the first instruction of transaction is a transfer of token fee and the rest instructions do not interact with fee payer's wallet.

It also implements additional checks: duplicated transactions, fee payer source and failing transactions detection using simulation.

```javascript
const { signature } = await signWithTokenFee(
    connection,
    transaction,
    feePayerKeypair,
    2,
    5000,
    [
        {
            mint: mint,
            account: feePayerTokenAccount.address,
            decimals: 9,
            fee: BigInt(100),
        },
    ],
    cache,
    2000
);
transaction.addSignature(feePayerKeypair.publicKey, base58.decode(signature));
await sendAndConfirmRawTransaction(connection, transaction.serialize(), { commitment: 'confirmed' });
```

| Parameter            | Type                                       | Description                                                          |
|----------------------|--------------------------------------------|----------------------------------------------------------------------|
| connection           | Connection from '@solana/web3.js'          | Connection to a Solana node                                          |
| transaction          | Transaction from '@solana/web3.js'         | Transaction to sign                                                  |
| feePayer             | Keypair from '@solana/web3.js'             | Keypair that will pay for transaction fees                           |
| maxSignatures        | number                                     | Maximum allowed signatures in the transaction including fee payer's  |
| lamportsPerSignature | number                                     | Maximum transaction fee payment amount in lamports                   |
| allowedTokens        | core.TokenFee[] from '@solana/octane-core' | List of tokens that can be used for Octane fees with associated info |
| cache                | Cache from 'cache-manager'                 | A cache to store duplicate transactions                              |
| sameSourceTimeout    | number                                     | An interval for transactions with same token fee source, ms          |

#### createAccountIfTokenFeePaid

Signs transaction by fee payer if both statements are true:

a) the first instruction is a transfer of token fee to given account

b) the second instruction creates an associated token account with initialization fees paid by fee payer.

This action allows end users to transfer some tokens to a new associated token account, while paying rent fees in SPL tokens instead of SOL.

Token fee for this operation should be higher than usual. Node owners pay SOL for both transaction fees and rent exemption of the newly created account.

```javascript
const { signature } = await createAccountIfTokenFeePaid(
    connection,
    accountTransaction,
    feePayerKeypair,
    2,
    5000,
    [
        {
            mint: mint,
            account: feePayerTokenAccount.address,
            decimals: 9,
            fee: BigInt(100),
        },
    ],
    cache,
    2000,
);
accountTransaction.addSignature(feePayerKeypair.publicKey, base58.decode(signature));
await sendAndConfirmRawTransaction(connection, accountTransaction.serialize(), { commitment: 'confirmed' });
```

| Parameter            | Type                                       | Description                                                          |
|----------------------|--------------------------------------------|----------------------------------------------------------------------|
| connection           | Connection from '@solana/web3.js'          | Connection to a Solana node                                          |
| transaction          | Transaction from '@solana/web3.js'         | Transaction to sign                                                  |
| feePayer             | Keypair from '@solana/web3.js'             | Keypair that will pay for transaction fees                           |
| maxSignatures        | number                                     | Maximum allowed signatures in the transaction including fee payer's  |
| lamportsPerSignature | number                                     | Maximum transaction fee payment amount in lamports                   |
| allowedTokens        | core.TokenFee[] from '@solana/octane-core' | List of tokens that can be used for Octane fees with associated info |
| cache                | Cache from 'cache-manager'                 | A cache to store duplicate transactions                              |
| sameSourceTimeout    | number                                     | An interval for transactions with same token fee source, ms          |


#### buildWhirlpoolsSwapToSOL

Creates a non-signed transaction with Whirlpools swap from one SPL token to unwrapped SOL.

The transaction has to be signed using `signGeneratedTransaction`. If you want full protection against failed transaction spend, you have to sign after receiving user's signature.

`messageToken` has to be passed to `signGeneratedTransaction` to verify that transaction hasn't changed since the generation.

Fee has to be paid in swapped token.

```javascript
const { transaction, quote, messageToken } = await buildWhirlpoolsSwapToSOL(
    connection,
    feePayerKeypair,
    userPublicKey,
    sourceMint,
    new BN(100000), // in token decimals
    slippingTolerance,
    cache,
    3000,
    {
        amount: Number(tokenFee.fee), // in token decimals
        sourceAccount: await getAssociatedTokenAddress(sourceMint, user),
        destinationAccount: tokenFee.account
    }
);
```

| Parameter         | Type                                  | Description                                                   |
|-------------------|---------------------------------------|---------------------------------------------------------------|
| connection        | Connection from '@solana/web3.js'     | Connection to a Solana node                                   |
| feePayer          | Keypair from '@solana/web3.js'        | Keypair that will pay for transaction fees                    |
| user              | PublicKey from '@solana/web3.js'      | Public key of user's wallet with tokens                       |
| sourceMint        | PublicKey from '@solana/web3.js'      | Mint of source token for swap                                 |
| amount            | BN from 'bn.js'                       | Amount of token to swap, in token decimals                    |
| slippingTolerance | Percentage from '@orca-so/common-sdk' | Slipping tolerance relative to transaction                    |
| cache             | Cache from 'cache-manager'            | A cache to store duplicate transactions                       |
| sameMintTimeout   | number                                | An interval for swap transactions with same mint and user, ms |
| feeOptions?       | FeeOptions from '@solana/octane-core' | A fee settings for Octane to charge on this swap              |

#### signGeneratedTransaction

Signs previously generated transaction by Octane. The transaction should have user's signature. The authenticity check is provided using `messageToken` argument, which is a signature for transaction's message.

```javascript
const { signature } = await signGeneratedTransaction(
    connection,
    transaction,
    feePayerKeypair,
    whirlpools.MESSAGE_TOKEN_KEY, // or 'whirlpools-swap'
    messageToken,
    cache,
);
transaction.addSignature(
    feePayerKeypair.publicKey,
    Buffer.from(base58.decode(signature))
);
await sendAndConfirmRawTransaction(
    connection,
    transaction.serialize(),
    {commitment: 'confirmed'}
);
```

| Parameter         | Type                                  | Description                                                         |
|-------------------|---------------------------------------|---------------------------------------------------------------------|
| connection        | Connection from '@solana/web3.js'     | Connection to a Solana node                                         |
| transaction       | Transaction from '@solana/web3.js'    | Transaction to sign                                                 |
| feePayer          | Keypair from '@solana/web3.js'        | Keypair that will pay for transaction fees                          |
| messageTokenKey   | string                                | Key used in messageToken generation, for example, 'whirlpools-swap' |
| messageToken      | string                                | Key returned from transaction generation action                     |
| cache             | Cache from 'cache-manager'            | A cache to store duplicate transactions                             |

### Core

Octane's core provides helper functions for implementing your own gasless signing logic.

You can view example of such usage in [octane-demo app's backend](https://github.com/sevazhidkov/octane-demo/blob/main/src/pages/api/auth-transactions/send.ts).

#### validateTransaction

Validates transaction metadata prior to signing by fee payer: fee payer, fee, signatures. After validation return signature by fee payer.

*Does not* validate instructions.

```javascript
import { core } from '@solana/octane-core';

let signature: string;
try {
    signature = (await core.validateTransaction(
        connection,
        transaction,
        feePayer,
        2,
        5000,
    )).signature;
} catch (e) {
    console.log(e);
    res.status(400).send({status: 'error', message: 'bad transaction'});
    return;
}
```

| Parameter            | Type                               | Description                                                         |
|----------------------|------------------------------------|---------------------------------------------------------------------|
| connection           | Connection from '@solana/web3.js'  | Connection to a Solana node                                         |
| transaction          | Transaction from '@solana/web3.js' | User's transaction                                                  |
| feePayer             | Keypair from '@solana/web3.js'     | Keypair that will pay for transaction fees                          |
| maxSignatures        | number                             | Maximum allowed signatures in the transaction including fee payer's |
| lamportsPerSignature | number                             | Maximum transaction fee payment amount in lamports                  |


#### validateInstructions

Checks that instructions in a transaction do not use fee payer's account as writable.

```javascript
try {
    await core.validateInstructions(transaction, feePayer);
  } catch (e) {
    res.status(400).send({status: 'error', message: 'bad instructions'});
    return;
  }
```

| Parameter         | Type                                  | Description                                |
|-------------------|---------------------------------------|--------------------------------------------|
| transaction       | Transaction from '@solana/web3.js'    | User's transaction                         |
| feePayer          | Keypair from '@solana/web3.js'        | Keypair that will pay for transaction fees |


### Payer utils

When providing gasless transactions for your users, you manage a Solana wallet that accepts tokens and stores SOL for user's transactions. Naturally, amount of SOL decreases and balances of tokens increase. You have to regularly swap tokens for SOL to keep node operational. Additionally, node operators have to create associated token accounts for each token they receive and setup pricing settings for each token individually.

`PayerUtils` are helper functions to manage your fee payer signing account.

#### getPopularTokens

Returns popular tokens from Jupyter aggregator.

| Parameter | Type   | Description                   |
|-----------|--------|-------------------------------|
| count     | number | Number of tokens from the top |

```javascript
const popularTokenMints = await PayerUtils.getPopularTokens(10);

// const tokensWithPriceInfo = await Promise.all(popularTokenMints.map(async mint => ({
//     mint: mint,
//     priceInfo: await PayerUtils.getTokenToNativePriceInfo(mint)
// })));
```

#### getTokenToNativePriceInfo

Returns token's price info from Jupyter aggregator.

```javascript
import { PayerUtils } from '@solana/octane-core';

const priceInfo = await PayerUtils.getTokenToNativePriceInfo(mint);

// const tokenFee = (await PayerUtils.buildTokenFeeList(
//     connection,
//     ENV_SECRET_KEYPAIR.publicKey,
//     [{ mint, priceInfo }],
//     pricingParams,
// ))[0];
```

| Parameter | Type                             | Description |
|-----------|----------------------------------|-------------|
| mint      | PublicKey from '@solana/web3.js' | Token mint  |

#### buildTokenFeeList

Builds a list of tokens with prices and accounts to receive fees. Should be used to configure `allowedTokens` parameter or `config.json`.

```javascript
const tokenFee = (await PayerUtils.buildTokenFeeList(
    connection,
    ENV_SECRET_KEYPAIR.publicKey,
    [{ mint, priceInfo }],
    { costInLamports: 5000, margin: 0.9 },
))[0];

console.log(JSON.stringify(tokenFee.toSerializable()));
```

| Parameter  | Type                                                       | Description                                                          |
|------------|------------------------------------------------------------|----------------------------------------------------------------------|
| connection | Connection from '@solana/web3.js'                          | Connection to a Solana node                                          |
| feePayer   | PublicKey from '@solana/web3.js'                           | Public key of a wallet that will receive fees in associated accounts |
| tokens     | TokenWithPriceInfo[] from '@solana/octane-core'.PayerUtils | Tokens with mints and price info that should be included             |
| params     | PricingParams from '@solana/octane-core'.PayerUtils        | Options to set price with margin                                     |

#### buildCreateAccountListFromTokenFees

Returns uncreated associated token accounts for fees from TokenFee list. You can create these accounts using `PayerUtils.createAccounts`.

```javascript
const createAccounts = await PayerUtils.buildCreateAccountListFromTokenFees(
    connection,
    ENV_SECRET_KEYPAIR.publicKey,
    config.endpoints.transfer.tokens.map((tokenFee) => core.TokenFee.fromSerializable(tokenFee))
);

console.log('accounts to create:', createAccounts);
```

| Parameter  | Type                                       | Description                                                          |
|------------|--------------------------------------------|----------------------------------------------------------------------|
| connection | Connection from '@solana/web3.js'          | Connection to a Solana node                                          |
| feePayer   | PublicKey from '@solana/web3.js'           | Public key of a wallet that will receive fees in associated accounts |
| tokenFees  | TokenFee[] from '@solana/octane-core'.core | Tokens configured to receive payments                                |


#### createAccounts

Creates associated token accounts returned from `buildCreateAccountListFromTokenFees`.

```javascript
const createAccounts = await PayerUtils.buildCreateAccountListFromTokenFees(
    connection,
    ENV_SECRET_KEYPAIR.publicKey,
    config.endpoints.transfer.tokens.map((tokenFee) => core.TokenFee.fromSerializable(tokenFee))
);
const result = await PayerUtils.createAccounts(connection, ENV_SECRET_KEYPAIR, createAccounts);
```

| Parameter      | Type                                                  | Description                                     |
|----------------|-------------------------------------------------------|-------------------------------------------------|
| connection     | Connection from '@solana/web3.js'                     | Connection to a Solana node                     |
| feePayer       | Keypair from '@solana/web3.js'                        | Keypair that will own associated token accounts |
| createAccounts | CreateAccount[] from '@solana/octane-core'.PayerUtils | Accounts to create                              |

#### loadSwapRoutesForTokenFees

Calculates swap routes from tokens to SOL using Jupyter aggregator API for a list of token fees.

It only returns tokens with balance higher than provided threshold.

Use `executeSwapByRoute` to execute each swap.

```javascript
const routesToSwap = await PayerUtils.loadSwapRoutesForTokenFees(
    connection,
    config.endpoints.transfer.tokens.map(token => core.TokenFee.fromSerializable(token)),
    parseInt(threshold),
    0.5
);
```

| Parameter           | Type                                       | Description                                                                     |
|---------------------|--------------------------------------------|---------------------------------------------------------------------------------|
| connection          | Connection from '@solana/web3.js'          | Connection to a Solana node                                                     |
| tokenFees           | TokenFee[] from '@solana/octane-core'.core | Tokens configured to receive payments, that would be checked for possible swaps |
| thresholdInLamports | number                                     | The minimum amount of SOL lamports to receive from a swap                       |
| slippage            | number                                     | Accepted slippage for the swap                                                  |



#### executeSwapByRoute

Execute calculated swaps from `loadSwapRoutesForTokenFees`.

```javascript
for (const route of routesToSwap) {
    const txids = await PayerUtils.executeSwapByRoute(connection, ENV_SECRET_KEYPAIR, route);
    console.log(`Executed transactions:`, txids);
}
```

| Parameter  | Type                                        | Description                                           |
|------------|---------------------------------------------|-------------------------------------------------------|
| connection | Connection from '@solana/web3.js'           | Connection to a Solana node                           |
| feePayer   | Keypair from '@solana/web3.js'              | Owner of token accounts                               |
| route      | Route from '@solana/octane-core'.PayerUtils | Minimum amount of SOL lamports to receive from a swap |

