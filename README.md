# Octane ⛽

## What is Octane?

Octane is a gasless transaction relayer for Solana.

Transaction fees on Solana are very inexpensive, but users still need SOL to pay for them, and they often don't know (or forget) this.

Sometimes a good friend (like you!) introduces them to Solana, and explaining that you need to get SOL first to do anything is tricky.

Sometimes users stake all their SOL or swap it for tokens or mint an NFT and don't have any left in their wallet.

Sometimes a merchant or dApp would like to pay for certain transactions on behalf of their users.

## How does it work?

Octane provides an API that lets users pay for transactions with SPL token transfers instead of native SOL.

A user creates a transaction that contains an instruction for a small token transfer to Octane, along with whatever else their transaction is supposed to do.

The user partially signs the transaction, authorizing it to make the transfer, and so it can't be modified by Octane or MITM attacks.

The user sends the serialized transaction to an Octane REST API endpoint.

Octane validates the transaction, signs it to pay the SOL, and broadcasts it on the Solana network.

When the transaction is confirmed, Octane will have been paid a fee in the token for this service.

Octane is designed for anyone to be able to run for free on Vercel as a collection of serverless Node.js API functions.

## Is this secure?

Octane operates trustlessly and is designed to be easily run by anyone in an adversarial environment.

It uses ratelimiting, transaction validation, and transaction simulation to mitigate DoS, spam, draining, and other attacks.

_However..._

---

🚨 **Octane is untested alpha software!** 🚨

---

Please don't run Octane on Mainnet Beta yet!

It may contain bugs and vulnerabilities.

It doesn't completely prevent spam.

It doesn't prevent simulation bypass attacks.

It doesn't use CAPTCHAs (but it could).

Please do help us build, test, and make it better.

## What does Octane want?

Octane wants to make Solana easier to use by abstracting away some complexity that leads to user confusion and error.

Octane wants to become integrated with wallets, support multiple tokens with different fees, and perform atomic swaps to pay for transactions or get SOL.

Octane wants to be customizable for decentralized applications that want to sponsor their users transactions.

Octane wants to create a seamless, competitive marketplace for gasless transactions.

Octane wants to be secure, well-tested, well-documented, and easy to use.

## How do I use it?

This part is coming soon! Sorry about that. 😅
