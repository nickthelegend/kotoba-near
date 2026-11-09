// Loads the gitignored deployer key for scripts. Never prints the key.
import { Account, KeyPair, KeyPairSigner, JsonRpcProvider } from 'near-api-js';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { TESTNET_RPC } from '../src/index.mjs';

export const root = resolve(import.meta.dirname, '../../..');

export async function loadCredentials(file = '.near-credentials/deployer.json') {
  if (process.env.NEAR_TESTNET_ACCOUNT || process.env.NEAR_TESTNET_PRIVATE_KEY) {
    return { account_id: process.env.NEAR_TESTNET_ACCOUNT, secret_key: process.env.NEAR_TESTNET_PRIVATE_KEY };
  }
  try { return JSON.parse(await readFile(resolve(root, file), 'utf8')); }
  catch { throw new Error(`Setup required: NEAR_TESTNET_ACCOUNT and NEAR_TESTNET_PRIVATE_KEY (or ${file})`); }
}

export async function signerFor(file) {
  const credentials = await loadCredentials(file);
  if (!credentials.account_id?.endsWith('.testnet') || !credentials.secret_key) throw new Error('Setup required: a testnet account and key');
  const provider = new JsonRpcProvider({ url: process.env.NEAR_TESTNET_RPC || TESTNET_RPC });
  return new Account(credentials.account_id, provider, new KeyPairSigner(KeyPair.fromString(credentials.secret_key)));
}

export const explorer = (hash) => `https://testnet.nearblocks.io/txns/${hash}`;
