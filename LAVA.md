
# Lava's Octane Documentation

## Refund Endpoint

We've added an API endpoint `/api/refund` that triggers the tokens-to-SOL flow.
This should be run periodically to keep the service's wallet funded in SOL, e.g.
by Vercel Cron Jobs.

This endpoint uses the `PayerUtils` library exposed by `packages/core`, in a
similar fashion to the CLI command `swap-tokens-to-sol` defined in
`packages/server/src/cli.rs`. It uses [jup.ag] to swap tokens received by the
Octane wallet for SOL.

The tokens must be listed on the "transfer" endpoint on Octane's `config.json`,
otherwise it won't work.

The endpoint is protected by and API key read from the `API_KEY` environment
variable, that should be set to a random string. The field `apiKey` on the POST
request body must match this string.

[jup.ag]: https://jup.ag

## Medici Action

