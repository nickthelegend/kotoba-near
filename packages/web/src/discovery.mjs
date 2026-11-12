// Discover public resolve/challenge calls, then obtain exact attested bytes from NEAR receipts.
// The deployed contract has no transaction-hash view. Read real public receipts;
// the independent browser checks bind their exact input/output to the attestation.
import { readResolutionReceipts } from '../../sdk/src/resolution-receipts.mjs';
export async function discoverResolutionRuns({ contract, marketId, fetcher = fetch, rpc = 'https://near-testnet.drpc.org', api = 'https://api-testnet.nearblocks.io' }) {
  if (!/^[a-z0-9._-]+\.testnet$/.test(contract) || !/^[a-z0-9-]+$/.test(marketId)) throw Error('Testnet market required');
  const candidates = new Map(); let cursor;
  for (let page = 0; page < 20; page++) {
    const url = new URL(`/v3/accounts/${contract}/txns`, api);
    url.searchParams.set('limit', '100'); url.searchParams.set('method', 'resolve,challenge');
    if (cursor) url.searchParams.set('next', cursor);
    const response = await fetcher(url.toString(), { signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw Error(`Public transaction lookup unavailable (HTTP ${response.status})`);
    const body = await response.json();
    if (!Array.isArray(body.data) || body.errors?.length) throw Error('Public transaction lookup returned invalid data');
    for (const tx of body.data) {
      if (tx.receiver_account_id !== contract || tx.outcomes?.status !== true || !tx.actions?.some(a => ['resolve', 'challenge'].includes(a.method))) continue;
      if (!/^[1-9A-HJ-NP-Za-km-z]{40,44}$/.test(tx.transaction_hash) || !tx.signer_account_id) continue;
      candidates.set(tx.transaction_hash, tx);
    }
    const next = body.meta?.next_page;
    if (!next) break;
    if (typeof next !== 'string' || next === cursor || page === 19) throw Error('Public transaction history could not be fully checked');
    cursor = next;
  }
  const runs = [];
  const newestFirst = [...candidates].sort((a, b) => Number(BigInt(b[1].block?.block_timestamp ?? b[1].block_timestamp) - BigInt(a[1].block?.block_timestamp ?? a[1].block_timestamp)));
  for (const [hash, candidate] of newestFirst) {
    const outcome = await readResolutionReceipts({ hash, sender: candidate.signer_account_id, fetcher, rpc, api });
    const tx = outcome.transaction;
    if (tx.hash !== hash || tx.receiver_id !== contract || tx.signer_id !== candidate.signer_account_id || outcome.status?.Failure) continue;
    if (outcome.status?.SuccessValue !== btoa('true')) continue; // on_result must have accepted the output.
    const call = tx.actions.map(a => a.FunctionCall).find(a => a && ['resolve', 'challenge'].includes(a.method_name));
    if (!call) continue;
    const args = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(call.args), c => c.charCodeAt(0))));
    if (args.id !== marketId) continue;
    const requests = (outcome.receipts ?? []).filter(r => r.receiver_id === 'outlayer.testnet').flatMap(r => r.receipt?.Action?.actions ?? []).map(a => a.FunctionCall).filter(a => a?.method_name === 'request_execution');
    const request = requests[0];
    const result = outcome.receipts_outcome.find(r => r.outcome.executor_id === 'outlayer.testnet' && r.outcome.status.SuccessValue && new TextDecoder().decode(Uint8Array.from(atob(r.outcome.status.SuccessValue), c => c.charCodeAt(0))).includes('transcript_sha256'));
    // Failed OutLayer callbacks refund their bond and can preserve an earlier valid
    // result. Such an attempt has no attested answer and must not hide that result's seal.
    if (!request || !result) continue;
    if (requests.length !== 1) throw Error('Matching resolution has ambiguous OutLayer receipts; retry');
    const decode = value => new TextDecoder().decode(Uint8Array.from(atob(value), c => c.charCodeAt(0)));
    const input = JSON.parse(decode(request.args)).input_data, output = decode(result.outcome.status.SuccessValue);
    if (typeof input !== 'string' || !Number.isInteger(JSON.parse(output).count)) throw Error('Resolution bytes are invalid');
    runs.push({ tx: hash, signer: tx.signer_id, method: call.method_name, at: String(candidate.block?.block_timestamp ?? candidate.block_timestamp), outlayer: { input, output } });
    // The factory permits one accepted resolve, followed by at most one accepted
    // challenge. Walking newest first has already collected any later challenge.
    if (call.method_name === 'resolve') break;
  }
  if (!runs.length) throw Error('No matching resolve or challenge is indexed yet. Retry in a moment.');
  return runs.sort((a, b) => Number(BigInt(a.at) - BigInt(b.at)));
}
