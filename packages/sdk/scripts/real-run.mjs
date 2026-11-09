// The public testnet run. Every step signs a real transaction and appends it to deployments/real-run.json.
//   node packages/sdk/scripts/real-run.mjs player                  create the player sub-account (key in .near-credentials/player.json)
//   node packages/sdk/scripts/real-run.mjs market <id> <yyyymmdd> <phrase> <threshold> <closeISO> <deadlineISO> "<event>"
//   node packages/sdk/scripts/real-run.mjs buy <who> <id> <yes|no> <qty>
//   node packages/sdk/scripts/real-run.mjs resolve|challenge <id>
//   node packages/sdk/scripts/real-run.mjs finalize <id>
//   node packages/sdk/scripts/real-run.mjs claim <who> <id>
import { actions, KeyPair } from 'near-api-js';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { signerFor, root, explorer } from './signer.mjs';
import { TESTNET_RPC } from '../src/index.mjs';
import { verifyExecution } from '../src/attestation.mjs';

const TGAS = 1_000_000_000_000n;
const NEAR = 10n ** 24n;
const milli = (n) => BigInt(Math.round(n * 1000)) * 10n ** 21n;
const recordPath = resolve(root, 'deployments/real-run.json');
const deployment = JSON.parse(await readFile(resolve(root, 'deployments/testnet-2026-11-09.json'), 'utf8'));
const contract = deployment.contract_id;
const record = await readFile(recordPath, 'utf8').then(JSON.parse).catch(() => ({ network: 'testnet', contract, steps: [] }));
const save = async () => { await mkdir(resolve(root, 'deployments'), { recursive: true }); await writeFile(recordPath, JSON.stringify(record, null, 2)); };

async function rpc(method, params) {
  const response = await fetch(TESTNET_RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 'kotoba', method, params }) });
  const body = await response.json();
  if (body.error) throw new Error(`${method}: ${JSON.stringify(body.error).slice(0, 300)}`);
  return body.result;
}
const signer = (who) => signerFor(who === 'player' ? '.near-credentials/player.json' : undefined);

async function send(who, step, method, args, deposit = 0n, gas = 100n * TGAS, receiverId = contract) {
  const account = await signer(who);
  const result = await account.signAndSendTransaction({ receiverId, actions: [actions.functionCall(method, args, gas, deposit)], waitUntil: 'FINAL', throwOnFailure: false });
  const failure = result.status.Failure ?? result.receipts_outcome.map((r) => r.outcome.status.Failure).find(Boolean) ?? null;
  const value = result.status.SuccessValue ? Buffer.from(result.status.SuccessValue, 'base64').toString() : null;
  const logs = result.receipts_outcome.flatMap((r) => r.outcome.logs);
  const entry = { step, signer: account.accountId, method, args, deposit_yocto: deposit.toString(), tx: result.transaction.hash, explorer: explorer(result.transaction.hash), at: new Date().toISOString(), ok: !failure, return: value, failure: failure ? JSON.stringify(failure).slice(0, 400) : null, logs: logs.filter((l) => !l.startsWith('[[')).slice(0, 8) };
  record.steps.push(entry);
  await save();
  console.log(`${entry.ok ? 'ok ' : 'FAIL'} ${step}: ${entry.explorer}${entry.return ? `  -> ${entry.return}` : ''}${entry.failure ? `\n  ${entry.failure}` : ''}`);
  if (!entry.ok && !step.startsWith('attack')) process.exit(1);
  return { entry, result };
}

// Pull the exact OutLayer input and output from the transaction's receipts, then verify the TDX attestation.
async function attest(entry, wasmHash) {
  const status = await rpc('EXPERIMENTAL_tx_status', { tx_hash: entry.tx, sender_account_id: entry.signer, wait_until: 'FINAL' });
  const request = status.receipts.flatMap((r) => r.receipt?.Action?.actions ?? []).map((a) => a.FunctionCall).find((f) => f?.method_name === 'request_execution');
  const input = JSON.parse(Buffer.from(request.args, 'base64').toString()).input_data;
  const outcome = status.receipts_outcome.find((r) => r.outcome.executor_id === 'outlayer.testnet' && r.outcome.status.SuccessValue && Buffer.from(r.outcome.status.SuccessValue, 'base64').toString().includes('transcript_sha256'));
  if (!outcome) throw new Error('OutLayer returned no oracle output in this transaction');
  const output = Buffer.from(outcome.outcome.status.SuccessValue, 'base64').toString();
  const outlayerLog = status.receipts_outcome.flatMap((r) => r.outcome.logs).find((l) => l.startsWith('Execution completed')) ?? null;
  let verification = null;
  for (let i = 0; i < 10 && !verification; i++) {
    try { verification = await verifyExecution({ txHash: entry.tx, input, output, wasmHash }); }
    catch (error) { if (i === 9) throw error; await new Promise((r) => setTimeout(r, 6000)); }
  }
  entry.outlayer = { input, output, log: outlayerLog, attestation: verification };
  await save();
  console.log(`attestation request ${verification.request_id}: ${verification.ok ? 'VERIFIED' : 'FAILED'} ${JSON.stringify(verification.checks)}`);
}

const [command, ...rest] = process.argv.slice(2);
if (command === 'player') {
  const key = KeyPair.fromRandom('ed25519');
  const id = `player.${contract}`;
  await writeFile(resolve(root, '.near-credentials/player.json'), JSON.stringify({ account_id: id, secret_key: key.toString() }), { mode: 0o600 });
  const account = await signerFor();
  const result = await account.signAndSendTransaction({ receiverId: id, actions: [actions.createAccount(), actions.transfer(milli(0.12)), actions.addFullAccessKey(key.getPublicKey())], waitUntil: 'FINAL', throwOnFailure: false });
  record.steps.push({ step: 'create player sub-account', signer: account.accountId, tx: result.transaction.hash, explorer: explorer(result.transaction.hash), at: new Date().toISOString(), ok: !result.status.Failure, account: id });
  await save();
  console.log(`player ${id}: ${explorer(result.transaction.hash)}`);
} else if (command === 'market') {
  const [id, date, phrase, threshold, closeIso, deadlineIso, event] = rest;
  const b = 100;
  const seed = BigInt(Math.ceil(b * Math.LN2)) * 10n ** 21n;
  await send('creator', `create market ${id}`, 'create_market', { id, event, source_url: `https://www.federalreserve.gov/mediacenter/files/FOMCpresconf${date}.pdf`, phrase, threshold: Number(threshold), close_ns: Date.parse(closeIso) * 1e6, deadline_ns: Date.parse(deadlineIso) * 1e6, b }, seed);
} else if (command === 'buy') {
  const [who, id, side, qty] = rest;
  const yes = side === 'yes';
  const quote = await rpc('query', { request_type: 'call_function', finality: 'final', account_id: contract, method_name: 'quote', args_base64: Buffer.from(JSON.stringify({ id, yes, quantity: Number(qty) })).toString('base64') });
  const amount = BigInt(JSON.parse(Buffer.from(quote.result).toString()));
  await send(who, `buy ${qty} ${side.toUpperCase()} on ${id}`, 'buy', { id, yes, quantity: Number(qty) }, amount, 30n * TGAS);
} else if (command === 'resolve' || command === 'challenge') {
  const [id] = rest;
  const { entry } = await send('creator', `${command} ${id} through OutLayer`, command, { id }, milli(0.1) + milli(0.02), 300n * TGAS);
  await attest(entry, deployment.oracle_sha256);
} else if (command === 'finalize') {
  await send('creator', `finalize ${rest[0]}`, 'finalize', { id: rest[0] });
} else if (command === 'claim') {
  await send(rest[0], `claim ${rest[1]} as ${rest[0]}`, 'claim', { id: rest[1] }, 0n, 30n * TGAS);
} else if (command === 'forge') {
  // Attack: a player calls the private OutLayer callback directly with a forged result. Expect a rejection.
  await send('player', `attack: forged on_result for ${rest[0]}`, 'on_result', { id: rest[0], challenged: false }, 0n, 30n * TGAS).catch(() => {});
} else {
  throw new Error('unknown command; see the header of this file');
}
