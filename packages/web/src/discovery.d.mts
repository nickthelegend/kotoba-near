export type DiscoveredRun = { tx: string; signer: string; method: 'resolve' | 'challenge'; at: string; outlayer: { input: string; output: string; attestation?: undefined } };
export function discoverResolutionRuns(options: { contract: string; marketId: string; fetcher?: typeof fetch; rpc?: string; api?: string }): Promise<DiscoveredRun[]>;
