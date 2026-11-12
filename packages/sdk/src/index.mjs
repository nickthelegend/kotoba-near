import { createHash } from 'node:crypto';
export const TESTNET_RPC = 'https://test.rpc.fastnear.com';
export const MAINNET_RPC = 'https://rpc.fastnear.com';
export const UNIT = 10n ** 21n;
// FastNEAR rate-limits shared IPs; the former rpc.testnet.near.org endpoint is retired.
export const TESTNET_RPC_FALLBACK = 'https://near-testnet.drpc.org';
export async function testnetFetch(init, primary = TESTNET_RPC) {
  let last;
  for (const url of [...new Set([primary, TESTNET_RPC_FALLBACK])]) {
    const response = await fetch(url, init).catch((e) => { last = e; return null; });
    if (response?.ok) {
      const body = await response.clone().json().catch(() => null);
      if (![-429, 30].includes(body?.error?.code)) return response;
      last = new Error(`NEAR testnet RPC temporarily unavailable at ${url}`);
      continue;
    }
    if (response) last = new Error(`NEAR testnet RPC HTTP ${response.status} at ${url}`);
  }
  throw last;
}

export function lmsrCost(yes, no, b) {
  if (![yes, no, b].every(Number.isFinite) || yes < 0 || no < 0 || b <= 0) throw new Error('Invalid LMSR parameters');
  const hi = Math.max(yes, no) / b;
  const lo = Math.min(yes, no) / b;
  return b * (hi + Math.log1p(Math.exp(lo - hi)));
}
export function lmsrPrices(yes, no, b) {
  const d = (yes - no) / b;
  const yesPrice = 1 / (1 + Math.exp(-d));
  return { yes: yesPrice, no: 1 - yesPrice };
}
export function lmsrQuote(yes, no, b, side, quantity) {
  if (!Number.isInteger(quantity) || quantity <= 0) throw new Error('Invalid quantity');
  return Math.ceil(lmsrCost(yes + (side === 'yes' ? quantity : 0), no + (side === 'no' ? quantity : 0), b) - lmsrCost(yes, no, b));
}

// Count ASCII whole words, ignoring case. Adjacent letters or digits invalidate a match.
// Every occurrence in the official full transcript counts, including reporters' questions.
export function countPhrase(text, phrase) {
  if (!/^[a-z]+(?: [a-z]+)*$/i.test(phrase)) throw new Error('Invalid phrase');
  const escaped = phrase.trim().replaceAll(' ', '\\s+');
  const expression = new RegExp(`(^|[^a-z0-9])(${escaped})(?=$|[^a-z0-9])`, 'gi');
  let count = 0;
  while (expression.exec(text)) count++;
  return count;
}
export function highlightPhrase(text, phrase) {
  if (!/^[a-z]+(?: [a-z]+)*$/i.test(phrase)) throw new Error('Invalid phrase');
  const escaped = phrase.trim().replaceAll(' ', '\\s+');
  return text.split(new RegExp(`(${escaped})`, 'gi')).map((part) => ({ text: part, hit: part.toLowerCase().replace(/\s+/g, ' ') === phrase.toLowerCase() }));
}
export function sha256(bytes) { return createHash('sha256').update(bytes).digest('hex'); }

export async function fetchFomcDates(year = new Date().getUTCFullYear()) {
  const response = await fetch('https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm', { signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`Fed calendar HTTP ${response.status}`);
  const html = await response.text();
  const start = html.indexOf(`${year} FOMC Meetings`);
  const end = html.indexOf(`${year - 1} FOMC Meetings`, start);
  if (start < 0 || end < 0) throw new Error(`Fed calendar has no parseable ${year} section`);
  const section = html.slice(start, end);
  const dates = [];
  const pattern = /fomc-meeting__month[^>]*><strong>([A-Za-z]+)<\/strong>[\s\S]*?fomc-meeting__date[^>]*>([^<]+)</g;
  for (const match of section.matchAll(pattern)) {
    const month = new Date(`${match[1]} 1, ${year} UTC`).getUTCMonth();
    const day = Number(match[2].match(/\d+(?!.*\d)/)?.[0]);
    if (!Number.isInteger(month) || !Number.isInteger(day) || day < 1 || day > 31) throw new Error('Fed calendar date parse failed');
    dates.push({ year, month: month + 1, day, calendar_url: 'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm' });
  }
  if (dates.length < 8) throw new Error(`Fed calendar yielded only ${dates.length} meetings`);
  return dates;
}

export async function fetchOfficialPdf(url) {
  if (!/^https:\/\/www\.federalreserve\.gov\/mediacenter\/files\/FOMCpresconf\d{8}\.pdf$/.test(url)) throw new Error('Unsupported transcript source');
  const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`Official transcript HTTP ${response.status}`);
  const pdf = Buffer.from(await response.arrayBuffer());
  if (pdf.subarray(0, 4).toString() !== '%PDF') throw new Error('Official source did not return a PDF');
  return { source_url: url, transcript_sha256: sha256(pdf), pdf };
}

export async function viewMarket(contractId, id, rpc = TESTNET_RPC) {
  if (!/^[a-z0-9._-]+\.testnet$/.test(contractId)) throw new Error('Setup required: NEAR_TESTNET_CONTRACT');
  const args_base64 = Buffer.from(JSON.stringify({ id })).toString('base64');
  const response = await testnetFetch({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 'kotoba', method: 'query', params: { request_type: 'call_function', finality: 'final', account_id: contractId, method_name: 'get_market', args_base64 } }) }, rpc);
  if (!response.ok) throw new Error(`NEAR RPC HTTP ${response.status}`);
  const body = await response.json();
  if (body.error) throw new Error(`NEAR RPC: ${body.error.message ?? JSON.stringify(body.error)}`);
  return JSON.parse(Buffer.from(body.result.result).toString('utf8'));
}

export async function estimateOutlayerCost(resourceLimits = { max_instructions: 10_000_000_000, max_memory_mb: 256, max_execution_seconds: 60 }, inputLen = 200) {
  const args_base64 = Buffer.from(JSON.stringify({ resource_limits: resourceLimits, input_len: inputLen })).toString('base64');
  const response = await testnetFetch({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 'kotoba-outlayer-cost', method: 'query', params: { request_type: 'call_function', finality: 'final', account_id: 'outlayer.testnet', method_name: 'estimate_execution_cost', args_base64 } }) });
  if (!response.ok) throw new Error(`NEAR testnet RPC HTTP ${response.status}`);
  const body = await response.json();
  if (body.error) throw new Error(`OutLayer estimate failed: ${body.error.message || JSON.stringify(body.error)}`);
  return BigInt(JSON.parse(Buffer.from(body.result.result).toString('utf8')));
}

/** A read-only 1Click preview. It never returns a deposit address or executes a swap. */
export async function oneClickDryQuote({ originAsset, destinationAsset, amount, recipient, refundTo, accountId = process.env.NEAR_MAINNET_ACCOUNT, jwt = process.env.ONECLICK_JWT }) {
  if (!accountId) throw new Error('Setup required: NEAR_MAINNET_ACCOUNT');
  if (!/^[a-z0-9._-]+\.near$/.test(accountId)) throw new Error('Setup required: NEAR_MAINNET_ACCOUNT');
  const balanceResponse = await fetch(MAINNET_RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 'kotoba', method: 'query', params: { request_type: 'view_account', finality: 'final', account_id: accountId } }) });
  if (!balanceResponse.ok) throw new Error(`NEAR mainnet RPC HTTP ${balanceResponse.status}`);
  const balance = await balanceResponse.json();
  if (balance.error || BigInt(balance.result?.amount ?? 0) === 0n) throw new Error('Setup required: funded NEAR_MAINNET_ACCOUNT');
  if (!originAsset || !destinationAsset || !/^\d+$/.test(amount) || !recipient || !refundTo) throw new Error('Quote parameters required');
  const request = { dry: true, swapType: 'EXACT_INPUT', slippageTolerance: 100, originAsset, depositType: 'ORIGIN_CHAIN', destinationAsset, amount, recipient, recipientType: 'DESTINATION_CHAIN', refundTo, refundType: 'ORIGIN_CHAIN', deadline: new Date(Date.now() + 3 * 60_000).toISOString() };
  const headers = { 'content-type': 'application/json', ...(jwt ? { authorization: `Bearer ${jwt}` } : {}) };
  const response = await fetch('https://1click.chaindefuser.com/v0/quote', { method: 'POST', headers, body: JSON.stringify(request) });
  const body = await response.json();
  if (!response.ok) throw new Error(`1Click quote HTTP ${response.status}: ${JSON.stringify(body).slice(0, 300)}`);
  return body;
}
