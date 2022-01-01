import {
    DecodedTransferCheckedInstruction,
    DecodedTransferInstruction,
    decodeInstruction,
    getAccount,
    isTransferCheckedInstruction,
    isTransferInstruction,
} from '@solana/spl-token';
import { PublicKey, Transaction } from '@solana/web3.js';
import config from '../../config.json';
import { connection } from './connection';

// Define a lookup table of allowed token mint public keys to their config values
interface Token {
    mint: PublicKey;
    account: PublicKey;
    decimals: number;
    fee: bigint;
}

const tokens = config.endpoints.transfer.tokens.reduce<Record<string, Token>>(function (tokens, token) {
    tokens[token.mint] = {
        mint: new PublicKey(token.mint),
        account: new PublicKey(token.account),
        decimals: token.decimals,
        fee: BigInt(token.fee),
    };
    return tokens;
}, {});

// Check that a transaction contains a valid transfer of an allowed token to Octane's token account
export async function validateTransfer(
    transaction: Transaction
): Promise<DecodedTransferInstruction | DecodedTransferCheckedInstruction> {
    // Get the first instruction of the transaction
    const [first] = transaction.instructions;
    if (!first) throw new Error('missing instructions');

    // Decode the first instruction and make sure it's a valid SPL Token `Transfer` or `TransferChecked` instruction
    const instruction = decodeInstruction(first);
    if (!(isTransferInstruction(instruction) || isTransferCheckedInstruction(instruction)))
        throw new Error('invalid instruction');

    const {
        keys: { source, destination, owner },
        data: { amount },
    } = instruction;

    // Check that the source account exists, has the correct owner, is not frozen, and has enough funds
    const account = await getAccount(connection, source.pubkey, 'confirmed');
    if (!account.owner.equals(owner.pubkey)) throw new Error('source invalid owner');
    if (account.isFrozen) throw new Error('source frozen');
    if (account.amount < amount) throw new Error('source insufficient balance');

    // Check that the source account's mint is one of the accepted tokens
    const token = tokens[account.mint.toBase58()];
    if (!token) throw new Error('invalid token');

    // Check that the instruction is going to pay the fee
    if (amount < token.fee) throw new Error('invalid amount');

    // Check that the instruction has a valid source account
    if (!source.isWritable) throw new Error('source not writable');
    if (source.isSigner) throw new Error('source is signer');

    // Check that the destination account is Octane's and is valid
    if (!destination.pubkey.equals(token.account)) throw new Error('invalid destination');
    if (!destination.isWritable) throw new Error('destination not writable');
    if (destination.isSigner) throw new Error('destination is signer');

    // Check that the owner of the source account is valid and has signed
    if (!owner.pubkey.equals(transaction.signatures[1].publicKey)) throw new Error('owner missing signature');
    if (owner.isWritable) throw new Error('owner is writable');
    if (!owner.isSigner) throw new Error('owner not signer');

    // If the instruction is a `TransferChecked` instruction, check that the mint and decimals are valid
    if (isTransferCheckedInstruction(instruction)) {
        const {
            keys: { mint },
            data: { decimals },
        } = instruction;

        if (decimals !== token.decimals) throw new Error('invalid decimals');

        if (!mint.pubkey.equals(token.mint)) throw new Error('invalid mint');
        if (mint.isWritable) throw new Error('mint is writable');
        if (mint.isSigner) throw new Error('mint is signer');
    }

    return instruction;
}
