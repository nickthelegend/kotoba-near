// Public testnet receipts only. No signing, credentials or bundled-success fallback.
const finalized = new Map();
const encode = value => btoa(String.fromCharCode(...new TextEncoder().encode(value)));
export async function readResolutionReceipts({ hash, sender, fetcher = fetch, rpc = 'https://near-testnet.drpc.org', api = 'https://api-testnet.nearblocks.io' }) {
  if (!/^[1-9A-HJ-NP-Za-km-z]{40,44}$/.test(hash) || !/^(?:[a-z0-9._-]+\.testnet|[a-f0-9]{64})$/.test(sender)) throw Error('Testnet transaction required');
  if (!/^https:\/\/(?:archival-rpc\.testnet\.near\.org|near-testnet\.drpc\.org|test\.rpc\.fastnear\.com)\/?$/.test(rpc) || api !== 'https://api-testnet.nearblocks.io') throw Error('Public testnet endpoints required');
  const key = `${rpc}/${hash}/${sender}`;
  if (fetcher === globalThis.fetch && finalized.has(key)) return finalized.get(key);
  let outcome;
  for (const endpoint of [...new Set([rpc, 'https://near-testnet.drpc.org'])]) {
    try {
      const response = await fetcher(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 'kotoba-seal-discovery', method: 'EXPERIMENTAL_tx_status', params: { tx_hash: hash, sender_account_id: sender, wait_until: 'FINAL' } }), signal: AbortSignal.timeout(12000) });
      const body = await response.json();
      if (response.ok && !body.error && body.result?.transaction?.hash === hash && body.result.transaction.signer_id === sender && body.result.final_execution_status === 'FINAL') { outcome = body.result; break; }
    } catch { /* A failed public provider is never evidence of success. */ }
  }
  if (!outcome) {
    const get = async suffix => {
      for (let attempt = 0; attempt < 4; attempt++) {
        const r = await fetcher(`${api}/v3/txns/${hash}${suffix}`, { signal: AbortSignal.timeout(20000) });
        if ([429, 502, 503, 504].includes(r.status) && attempt < 3) {
          const retrySeconds = Number(r.headers.get('retry-after'));
          await new Promise(resolve => setTimeout(resolve, Math.min(10000, Math.max(1000 * 2 ** attempt, retrySeconds * 1000 || 0))));
          continue;
        }
        if (!r.ok) throw Error(`Public transaction receipts unavailable (HTTP ${r.status}); retry`);
        const b = await r.json(); if (!b.data || b.errors?.length) throw Error('Public transaction receipts are unavailable; retry'); return b.data;
      }
    };
    const [tx, tree] = await Promise.all([get(''), get('/receipts')]);
    if (tx.transaction_hash !== hash || tx.signer_account_id !== sender || tx.receiver_account_id !== tree.receiver_account_id || tx.outcomes?.status !== true) throw Error('Public transaction identity or outcome mismatch');
    const nodes = []; const visit = r => { nodes.push(r); for (const child of r.receipts ?? []) visit(child); }; visit(tree);
    const byId = new Map(nodes.map(r => [r.receipt_id, r]));
    let terminal = tree; const seen = new Set();
    while (terminal.outcome?.status_key === 'SUCCESS_RECEIPT_ID') {
      if (seen.has(terminal.receipt_id)) throw Error('Cyclic public receipt data');
      seen.add(terminal.receipt_id); terminal = byId.get(terminal.outcome.result);
      if (!terminal) throw Error('Public callback receipt is not indexed yet; retry');
    }
    // Follow the actual promise return to on_result. A transfer or successful
    // request_execution alone does not establish that the factory accepted it.
    const accepted = terminal.receiver_account_id === tx.receiver_account_id && terminal.actions?.some(a => a.method === 'on_result') && terminal.outcome?.status_key === 'SUCCESS_VALUE';
    const receipts = nodes.map(r => ({ receiver_id: r.receiver_account_id, receipt: { Action: { actions: (r.actions ?? []).filter(a => a.action === 'FUNCTION_CALL').map(a => {
      let args = a.args?.args_base64;
      if (r.receiver_account_id === 'outlayer.testnet' && a.method === 'request_execution') {
        // NearBlocks args_json escapes nested strings. The emitted request_data
        // log retains the exact input bytes; never reconstruct or unescape them.
        const events = (r.outcome?.logs ?? []).filter(l => l.startsWith('EVENT_JSON:')).map(l => JSON.parse(l.slice(11))).filter(e => e.event === 'execution_requested');
        const requests = events.flatMap(e => e.data ?? []).map(d => JSON.parse(d.request_data));
        if (requests.length !== 1 || typeof requests[0].input_data !== 'string') throw Error('Exact OutLayer input log is unavailable; retry');
        args = encode(JSON.stringify({ input_data: requests[0].input_data, source: { WasmUrl: { hash: requests[0].code_source?.WasmUrl?.hash } } }));
      }
      return { FunctionCall: { method_name: a.method, args: args ?? encode(JSON.stringify(a.args?.args_json ?? {})) } };
    }) } } }));
    outcome = {
      transaction: { hash, signer_id: sender, receiver_id: tx.receiver_account_id, actions: tx.actions.filter(a => a.action === 'FUNCTION_CALL').map(a => ({ FunctionCall: { method_name: a.method, args: a.args?.args_base64 ?? encode(JSON.stringify(a.args?.args_json ?? {})) } })) },
      status: accepted ? { SuccessValue: terminal.outcome.result } : { Failure: 'Factory callback did not accept this resolution' },
      receipts,
      receipts_outcome: nodes.map(r => ({ outcome: { executor_id: r.outcome?.executor_account_id, status: r.outcome?.status_key === 'SUCCESS_VALUE' ? { SuccessValue: r.outcome.result } : {} } })),
    };
  }
  if (fetcher === globalThis.fetch) { if (finalized.size >= 200) finalized.delete(finalized.keys().next().value); finalized.set(key, outcome); }
  return outcome;
}
