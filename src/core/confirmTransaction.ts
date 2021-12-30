import { ConfirmedTransaction, Connection, TransactionSignature } from '@solana/web3.js';

// Check that a transaction has been confirmed
export async function confirmTransaction(
    signature: TransactionSignature,
    connection: Connection
): Promise<ConfirmedTransaction> {
    const result = await connection.confirmTransaction(signature, 'confirmed');
    if (result.value.err) throw result.value.err;

    // FIXME: probably not necessary
    const confirmed = await connection.getConfirmedTransaction(signature, 'confirmed');
    if (!confirmed) throw new Error('transaction not found');

    return confirmed;
}
