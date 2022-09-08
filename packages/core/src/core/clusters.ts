const MAINNET_BETA_GENESIS_HASH = '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d';

export function isMainnetBetaCluster(genesisHash: string) {
    return genesisHash === MAINNET_BETA_GENESIS_HASH;
}
