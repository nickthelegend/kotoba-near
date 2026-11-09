import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

test('MCP exposes read-only tools and explicit setup state', { timeout: 10_000 }, async () => {
  const child = spawn(process.execPath, [fileURLToPath(new URL('../src/main.mjs', import.meta.url))], { stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, NEAR_TESTNET_CONTRACT: '' } });
  const lines = createInterface({ input: child.stdout });
  const replies = new Map();
  lines.on('line', line => { const message = JSON.parse(line); if (message.id != null) replies.get(message.id)?.(message); });
  let id = 0;
  const request = (method, params) => new Promise(resolve => { const next = ++id; replies.set(next, resolve); child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: next, method, params }) + '\n'); });
  try {
    const init = await request('initialize', { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'kotoba-test', version: '1' } });
    assert.equal(init.result.serverInfo.name, 'kotoba');
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
    const tools = await request('tools/list', {});
    assert.deepEqual(tools.result.tools.map(tool => tool.name).sort(), ['kotoba_get_market', 'kotoba_list_markets', 'kotoba_verify_resolution']);
    const result = await request('tools/call', { name: 'kotoba_list_markets', arguments: {} });
    assert.equal(result.result.isError, true);
    assert.match(result.result.content[0].text, /Setup required: NEAR_TESTNET_CONTRACT/);
  } finally { child.kill(); }
});

test('MCP verifies a real testnet resolution through the attestation tool', { timeout: 90_000 }, async () => {
  const { readFile } = await import('node:fs/promises');
  const run = JSON.parse(await readFile(new URL('../../../deployments/real-run.json', import.meta.url), 'utf8'));
  const resolve = run.steps.find(s => s.method === 'resolve' && s.outlayer);
  const child = spawn(process.execPath, [fileURLToPath(new URL('../src/main.mjs', import.meta.url))], { stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, NEAR_TESTNET_CONTRACT: run.contract } });
  const lines = createInterface({ input: child.stdout });
  const replies = new Map();
  lines.on('line', line => { const message = JSON.parse(line); if (message.id != null) replies.get(message.id)?.(message); });
  let id = 0;
  const request = (method, params) => new Promise(resolve => { const next = ++id; replies.set(next, resolve); child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: next, method, params }) + '\n'); });
  try {
    await request('initialize', { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'kotoba-test', version: '1' } });
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
    const markets = await request('tools/call', { name: 'kotoba_list_markets', arguments: {} });
    assert.ok(JSON.parse(markets.result.content[0].text).some(m => m.id === 'fomc-2026-01-inflation-40'));
    const verified = await request('tools/call', { name: 'kotoba_verify_resolution', arguments: { tx_hash: resolve.tx, sender_id: resolve.signer } });
    const body = JSON.parse(verified.result.content[0].text);
    assert.equal(body.output.count, 40);
    assert.equal(body.verification.ok, true, JSON.stringify(body.verification.checks));
  } finally { child.kill(); }
});
