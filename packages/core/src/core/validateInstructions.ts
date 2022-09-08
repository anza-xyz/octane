import { Keypair, Transaction } from '@solana/web3.js';

// Prevent draining by making sure that the fee payer isn't provided as writable or a signer to any instruction.
// Throws an error if transaction contain instructions that could potentially drain fee payer.
export async function validateInstructions(transaction: Transaction, feePayer: Keypair): Promise<void> {
    for (const instruction of transaction.instructions) {
        for (const key of instruction.keys) {
            if ((key.isWritable || key.isSigner) && key.pubkey.equals(feePayer.publicKey))
                throw new Error('invalid account');
        }
    }
}
