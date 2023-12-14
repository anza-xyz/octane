# Example integration

This guide will walk you through integrating with an existing Octane node to send a gasless transfer.

## Load Octane config

First, let's load Octane node configuration. We need to know how many tokens we should transfer to pay for their transaction and which account will be the fee payer:

```javascript
const response = (await axios.get('https://octane-devnet.breakroom.show/api', {
headers: {'Accept': 'application/json'}
})).data;
const feePayer = new PublicKey(response.feePayer);

// First token in the list is USDC
const mint = new PublicKey(response.endpoints.transfer.tokens[0].mint);
const simpleTransactionFee = response.endpoints.transfer.tokens[0].fee;
```

## Prepare transaction

Before we can proceed, we'll need some additional information about the user:
```javascript
// `publicKey` should be loaded from wallet adapter
const userTokenAccount = await getAssociatedTokenAddress(mint, publicKey);

// Let's say we want to send a gasless transfer to this public key
const targetOwner = new PublicKey('EmMC1F6X25qsnXVzNzKUyqFWfLF2GsVJW55fGJRm9feY');
const targetAccount = await getAssociatedTokenAddress(mint, targetOwner);
```

Now, we're ready to create the transaction with two instructions:

1. Send token fee to Octane's account
2. Send token transfer to any public key (but this transaction could be anything else)

We also should set feePayer and recentBlockhash, and then sign the transaction using the end user wallet.

```javascript
const transaction = new Transaction();

transaction.add(createTransferInstruction(userTokenAccount, tokenAccount.address, userPublicKey, simpleTransactionFee));
transaction.add(createTransferInstruction(userTokenAccount, targetAccount, userPublicKey, 100));
transaction.feePayer = feePayer;
transaction.recentBlockhash = (await connection.getRecentBlockhash()).blockhash;

await signTransaction(transaction);
```

## Submit transaction

Now, we have the transaction with end user's signature. However, the transaction lacks signature of fee payer.

We need to call an Octane HTTP endpoint to get transaction signed and submitted to the network:

```javascript
const octaneResponse = (await axios.post('https://octane-mainnet-beta.breakroom.show/api/transfer', {
transaction: base58.encode(transaction.serialize({requireAllSignatures: false})),
})).data;
console.log(octaneResponse);
```

It's done!
