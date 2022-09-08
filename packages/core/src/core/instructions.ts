import { TransactionInstruction } from '@solana/web3.js';

export function areInstructionsEqual(instruction1: TransactionInstruction, instruction2: TransactionInstruction) {
    return (
        instruction1.data.equals(instruction2.data) &&
        instruction1.programId.equals(instruction2.programId) &&
        instruction1.keys.every(
            (key1, i) =>
                key1.pubkey.equals(instruction2.keys[i].pubkey) &&
                key1.isWritable === instruction2.keys[i].isWritable &&
                key1.isSigner === instruction2.keys[i].isSigner
        )
    );
}
