# Recipes

If you are considering integrating with Octane, this page will provide examples of how exactly you can use it in various types of apps.

## Transaction fees in SPL tokens

In its simplest form, Octane allows to submit transactions in client-side code without paying transaction fees in SOL in exchange for an equivalent payment in liquid SPL tokens. For example, a client pays 0.001 USDC to Octane node and submits transaction with fee payer equal to Octane address.

To do that, you need form a transaction in your client code (whether it's a mobile or web app) with token transfer to Octane as first instruction and any other instructions ("payload"). Then, you need to call Octane node's `/api/transfer` endpoint with serialized transaction. The endpoint will sign transaction on Octane's behalf and submit it to the network.

Octane's configuration with fee payer public key and fee amount for your operations can be loaded by calling `/api` endpoint.

Payload instructions shouldn't create any new accounts. If your use cases require to create new accounts, go to the just-in-time swaps section.

It's recommended to go through Octane flow only if user's wallet doesn't have any SOL to send transactions.

_Who can use it?_
* Wallets: for defined transactions like transfers or arbitrary transactions submitted via wallet-adapter (unless they create new accounts)
* Dapps
* Dapps with their own tokens

_Examples:_
* [Signing an SPL transfer transaction in Next.js SPA](https://github.com/sevazhidkov/octane-demo/blob/main/src/views/transfer.tsx)

### Public and private nodes

You can either use public Octane nodes or setup your own one.

When using someone's public Octane node, you don't need to manage fee payment process on backend at all. Just load node's config and submit transactions from client code. However, you are limited to SPL tokens from node owner configuration at their price.

If you'd like to set your own prices or SPL tokens or you generally like to self-host infrastructure, set up your own node. You'll need to also manage fee payer's keypair by topping it up with SOL and swapping accepted tokens to SOL regularly.

When choosing liquid tokens to accept as a node owner, you can refer to [solana-gasless-research](https://github.com/sevazhidkov/solana-gasless-research) and popular tokens on exchanges.

### Using your own token

If you have your own token, you can setup Octane node to accept this token for fee payments. You can airdrop tokens to users who you'd like to help transacting. In this scenario, you have to setup Octane node yourself, since other operators, probably, won't accept that token.

You have to monitor token emission and fee pricing, regularly top up fee keypair with more SOL. When you accept liquid tokes, running an Octane node breaks even or is slightly profitable. When using your own token, Octane node just spends SOL without much return except easier transactions for token owners.

Also, you have to set checks on token emission using ReCaptcha, auth or whitelists. Otherwise, if anyone can request an airdrop, your fee payer account can be drained.

### Creating associated token accounts

Octane generally doesn't support creating accounts in transaction instructions. However, there is a separate endpoint to create an associated token account for any owner and mint without spending SOL.

When implementing SPL token transfers, if transfer sender doesn't have SOL and transfer recipient doesn't have associated token account, use `/api/createAssociatedTokenAccount` Octane endpoint prior to sending the actual transfer transaction using `/api/transfer`.

This endpoint accepts a transaction with two instructions:
* First instruction should transfer a fee to Octane (this fee is higher than normal, since Octane pays for rent-exemption minimum)
* Second instruction should create an associated token account for recipient

The `/api/createAssociatedTokenAccount` endpoint then signs and sends the transaction to the network. Once it's confirmed, you can execute the transfer transaction using `/api/transfer` endpoint.

You can refer to [this example](https://github.com/sevazhidkov/octane-demo/blob/main/src/views/transfer.tsx), which implements creating an associated account if transfer recipient  doesn't have one.

### Anchor programs

When using Anchor, do not generate transactions using `program.transaction.*` methods. Instead, generate instructions for transactions and manually add them to transaction, then set Octane as fee payer for that transaction.

## SPL token to SOL swap

You can facilitate swaps from SPL tokens to SOL without paying transaction fees in SOL.

Running a gasless swap is a three-step process:
1. Create a swap transaction by calling `/api/buildWhirlpoolsSwap` endpoint (or equivalent endpoint for a provider other than Whirlpools) from the client. You'll have to pass user's public key, source mint, amount and slippage. The transaction will also send a fee to Octane node.
2. Sign the returned transaction using wallet-adapter
3. Send the transaction to the network using `/api/sendWhirlpoolsSwap`. You'll also have to pass `messageToken` received from the step 1.

It's recommended to use this Octane flow only if user doesn't have SOL. Fallback to regular swaps in other cases.

_Who can use it?_
* Wallets: as part of their swap interface or on transaction signing modal when user doesn't have enough SOL to run some transaction
* Dapps: as a standalone function or as a tool to get enough SOL to run in-app transactions

_Examples:_
* [A swap using Whirlpools in Next.js app](https://github.com/sevazhidkov/octane-demo/blob/main/src/views/swap.tsx)
* [A swap for enough SOL to execute a specific transaction in Next.js app](https://github.com/sevazhidkov/octane-demo/blob/main/src/views/just-in-time-swap.tsx)

### Just-in-time swap

When a dapp runs complex transactions that create new accounts, it's not possible to use `/api/transfer` endpoint. However, you can swap some of user's SPL tokens to SOL. Then, user can pay transaction fees with that SOL.

Just-in-time swap is a client-side technique: estimate how much SOL a transaction will require, run SPL token to SOL swap via Octane using one of user's liquid tokens, then run the original transaction without Octane.

This way you can support Metaplex NFT mints and any other transaction within your dapp. Wallets can use this strategy to allow one-click SOL conversions on transaction confirmation modal.

You can scan through user's tokens to determine which ones could be converted to SOL. Octane node has to specify each supported token mint in config.

### Free swaps

When using Octane as a library, you run swaps without charging any fees. Make sure you authorize all users that have access to  such swaps and establish limits.

## Fully sponsoring fees for authorized users

If you would like to onboard users with completely empty wallets, you can sponsor their transactions.

In this case, you can use [Octane as a library](./library.md).

Create an HTTP endpoint on your backend app that:
* Validates that user is authenticated
* Increments and validates request limit for this user
* Increments and validates request limit for this IP address
* Optionally, increments and validates request limit for device id from a tool like [Fingerprint.js](https://github.com/fingerprintjs/fingerprintjs)
* Optionally, validates and checks risk score from [ReCaptcha invisible challenge](https://developers.google.com/recaptcha/docs/invisible)
* Validates that transaction meta is valid using `core.validateTransaction` method from `@solana-labs/octane-core`
* Validates that instructions do not try to drain fee payer using `core.validateInstruction` method from `@solana-labs/octane-core`
* Simulates transaction using `connection.simulateTransaction` from `@solana-labs/web3.js` or `core.simulateRawTransaction` from `@solana-labs/octane-core`
* If all checks pass, signs from fee payer keypair and submit transaction to the network

You should pass payload transaction from client to this endpoint. The passed transaction has to include `feePayer`, so you have to either create a new endpoint to return fee payer's public key or hardcode it to the frontend app.

By establishing limits and regularly topping up the fee payer's wallet, your users will be able to run transactions while having empty wallets.

_Who can use it?_
* Dapps that want to onboard users with empty wallets and run transactions that do not require liquid funds (creating your own token or a DAO, SPL memo, etc.)

_Examples:_
* [Backend endpoints for fully sponsored transaction](https://github.com/sevazhidkov/octane-demo/blob/main/src/pages/api/auth-transactions/send.ts)
* [Frontend handling fully sponsored transactions](https://github.com/sevazhidkov/octane-demo/blob/main/src/views/transaction-with-auth.tsx)

## When not to use Octane?

You shouldn't use Octane when you want to run transactions that do not require end user's signature. For example, token airdrops do not require recipient's signature. You can run them without Octane.


You shouldn't fully sponsor transactions for unauthorized users (or when authorization process is easy to automate) or without setting strict limits on amount of transactions.
