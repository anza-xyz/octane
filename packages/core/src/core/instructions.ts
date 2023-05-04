import { TransactionInstruction } from '@solana/web3.js';

export function areInstructionsEqual(instruction1: TransactionInstruction, instruction2: TransactionInstruction) {
    return (
        instruction1.data.equals(instruction2.data) &&
        instruction1.programId.equals(instruction2.programId) &&
        instruction2.keys.every(
            (key2, i) =>
                key2.pubkey.equals(instruction1.keys[i].pubkey) &&
                key2.isWritable === instruction1.keys[i].isWritable &&
                key2.isSigner === instruction1.keys[i].isSigner
        )
    );
}
