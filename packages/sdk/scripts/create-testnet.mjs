import { KeyPair } from 'near-api-js';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../../..');
const dir = resolve(root, '.near-credentials');
const file = resolve(dir, 'deployer.json');
await mkdir(dir, { recursive: true, mode: 0o700 });
let credentials;
try { credentials = JSON.parse(await readFile(file, 'utf8')); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
const key = credentials ? KeyPair.fromString(credentials.secret_key) : KeyPair.fromRandom('ed25519');
const account_id = credentials?.account_id || `kotoba-${randomBytes(4).toString('hex')}.testnet`;
if (!credentials) await writeFile(file, JSON.stringify({ account_id, secret_key: key.toString() }), { mode: 0o600 });
const response = await fetch('https://helper.nearprotocol.com/account', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ newAccountId: account_id, newAccountPublicKey: key.getPublicKey().toString() }) });
if (!response.ok) throw new Error(`Testnet account helper HTTP ${response.status}: ${String(await response.text()).slice(0, 200)}`);
console.log(`Created testnet account ${account_id}; key saved in gitignored .near-credentials/deployer.json`);
