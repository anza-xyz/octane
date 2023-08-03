import { Connection, Transaction, Keypair, PublicKey } from '@solana/web3.js';
import { Cache } from 'cache-manager';

export function validateMediciActionInstructions(
    connection: Connection,
    originalTransaction: Transaction,
    medici_program_id: PublicKey,
    feePayer: Keypair,
    cache: Cache
) {
    const transaction = Transaction.from(originalTransaction.serialize({ requireAllSignatures: false }));

    if (transaction.instructions.length != 2) {
        throw new Error('medici transaction can only have two instructions');
    }

    const instruction = transaction.instructions[1];

    if (!instruction.programId.equals(medici_program_id)) {
        throw new Error('account instruction should call medici program');
    }

    // TODO: cache

    // const associatedToken = '';

    // // Prevent trying to create same accounts too many times within a short timeframe (per one recent blockhash)
    // const key = `account/${transaction.recentBlockhash}_${associatedToken.toString()}`;
    // if (await cache.get(key)) throw new Error('duplicate account within same recent blockhash');
    // await cache.set(key, true);
}
