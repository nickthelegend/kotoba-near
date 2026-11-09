#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { viewMarket, testnetFetch, TESTNET_RPC } from '@kotoba/sdk';
import { verifyResolutionTx } from '@kotoba/sdk/attestation';

const server = new McpServer({ name: 'kotoba', version: '0.1.0' });
const output = value => ({ content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] });
const failure = error => ({ isError: true, content: [{ type: 'text', text: error instanceof Error ? error.message : String(error) }] });
function config() {
  const contract = process.env.NEAR_TESTNET_CONTRACT;
  if (!contract) throw new Error('Setup required: NEAR_TESTNET_CONTRACT');
  return { contract, rpc: process.env.NEAR_TESTNET_RPC || TESTNET_RPC };
}
async function listMarkets() {
  const { contract, rpc } = config();
  const response = await testnetFetch({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 'kotoba', method: 'query', params: { request_type: 'call_function', finality: 'final', account_id: contract, method_name: 'list_markets', args_base64: 'e30=' } }) }, rpc);
  const body = await response.json();
  if (body.error) throw new Error(`NEAR RPC: ${body.error.message ?? JSON.stringify(body.error)}`);
  return JSON.parse(Buffer.from(body.result.result).toString('utf8'));
}
server.registerTool('kotoba_list_markets', { title: 'Live Kotoba markets', description: 'Read the current markets from the NEAR testnet contract.', annotations: { readOnlyHint: true } }, async () => { try { return output(await listMarkets()); } catch (error) { return failure(error); } });
server.registerTool('kotoba_get_market', { title: 'Live Kotoba market', description: 'Read one market from the NEAR testnet contract.', inputSchema: { id: z.string() }, annotations: { readOnlyHint: true } }, async ({ id }) => { try { const { contract, rpc } = config(); return output(await viewMarket(contract, id, rpc)); } catch (error) { return failure(error); } });
server.registerTool('kotoba_verify_resolution', { title: 'Verify an OutLayer resolution', description: 'Given a resolve or challenge transaction, read the exact OutLayer input and output from the chain and verify the Intel TDX attestation: pinned program hash, input and output hashes, report_data binding, approved enclave measurements and the Intel signature chain.', inputSchema: { tx_hash: z.string(), sender_id: z.string() }, annotations: { readOnlyHint: true } }, async ({ tx_hash, sender_id }) => { try { return output(await verifyResolutionTx(tx_hash, sender_id)); } catch (error) { return failure(error); } });
await server.connect(new StdioServerTransport());
