import { PublicKey } from '@solana/web3.js';

type SerializableTokenFee = {
    mint: string;
    account: string;
    decimals: number;
    fee: number;
}

export class TokenFee {
    public mint: PublicKey;
    public account: PublicKey;
    public decimals: number;
    public fee: bigint;

    constructor(mint: PublicKey, account: PublicKey, decimals: number, fee: bigint) {
        this.mint = mint;
        this.account = account;
        this.decimals = decimals;
        this.fee = fee;
    }

    toSerializable(): SerializableTokenFee {
        return {
            mint: this.mint.toBase58(),
            account: this.account.toBase58(),
            decimals: this.decimals,
            fee: Number(this.fee)
        };
    }

    static fromSerializable(serializableToken: SerializableTokenFee): TokenFee {
        return new TokenFee(
            new PublicKey(serializableToken.mint),
            new PublicKey(serializableToken.account),
            serializableToken.decimals,
            BigInt(serializableToken.fee)
        );
    }
}
