// Development-only wallet-selector module. Production imports are removed in wallet.ts.
// Credentials arrive from Playwright memory, never from Vite env, storage or a file in the browser.
import type { InjectedWallet, WalletModuleFactory } from '@near-wallet-selector/core';
import { CONTRACT } from './lib';
import { Account, Connection, KeyPair, keyStores, transactions, utils } from 'near-api-js';

type SignAndSendTransactionParams = Parameters<InjectedWallet['signAndSendTransaction']>[0];
class QaAccount extends Account {
  signCall(receiver: string, actions: transactions.Action[]) { return this.signTransaction(receiver, actions); }
}

export const QA_SIGNER_MARKER = 'kotoba-qa-signer';
const ALLOWED_RPC = new Set(['https://near-testnet.drpc.org', 'https://test.rpc.fastnear.com', 'https://archival-rpc.testnet.near.org']);
const CAP = 3n * 10n ** 23n; // 0.3 NEAR, including a conservative prepaid gas reservation.
const CONNECTED = 'kotoba-qa-signer-connected'; // Public session flag only; no credential storage.
type Config = { accountId: string; secretKey: string; rpcUrl: string; allowedMarketIds?: string[]; allowedMethods?: string[] };
type PublicEvent = { hash: string; accountId: string; receiverId: string; methods: string[]; depositYocto: string; gas: string; stage: string; at: string; gasBurntYocto?: string };
declare global {
  interface Window {
    __KOTOBA_QA_SIGNER__?: Config;
    __KOTOBA_QA_REPORT_TX__?: (event: PublicEvent) => Promise<void>;
  }
}
function requireTestnet(account: string) {
  if (!/^[a-z0-9][a-z0-9._-]*\.testnet$/.test(account)) throw new Error('QA_TESTNET_ACCOUNT_REQUIRED');
}
async function rpc(url: string, method: string, params: unknown): Promise<any> {
  const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: QA_SIGNER_MARKER, method, params }), signal: AbortSignal.timeout(15000) });
  const body = await response.json();
  if (!response.ok || body.error) throw new Error(`QA_RPC_${method.toUpperCase()}_UNAVAILABLE`);
  return body.result;
}
export function setupQaSigner(): WalletModuleFactory<InjectedWallet> {
  return async ({ options }) => {
    if (!import.meta.env.DEV || import.meta.env.VITE_QA_SIGNER !== '1') throw new Error('QA_SIGNER_DISABLED');
    if (options.network.networkId !== 'testnet') throw new Error('QA_TESTNET_NETWORK_REQUIRED');
    return {
      id: 'qa-signer', type: 'injected',
      metadata: { name: 'QA signer', description: 'Local testnet automation only', iconUrl: '', downloadUrl: '', available: true, deprecated: false },
      async init() {
        let state: { accountId: string; rpcUrl: string; account: QaAccount; publicKey: ReturnType<KeyPair['getPublicKey']>; allowedMarketIds?: string[]; allowedMethods?: string[] } | undefined;
        const contractId = CONTRACT;
        requireTestnet(contractId);
        let reserved = BigInt(sessionStorage.getItem('kotoba-qa-reserved') ?? '0');
        let queue: Promise<unknown> = Promise.resolve();
        function credentials() {
          if (state) return state;
          const config = window.__KOTOBA_QA_SIGNER__;
          if (!config) throw new Error('QA_STARTUP_CREDENTIALS_REQUIRED');
          requireTestnet(config.accountId);
          if (!ALLOWED_RPC.has(config.rpcUrl.replace(/\/$/, ''))) throw new Error('QA_TESTNET_RPC_REQUIRED');
          if (typeof window.__KOTOBA_QA_REPORT_TX__ !== 'function') throw new Error('QA_EVIDENCE_CALLBACK_REQUIRED');
          return config;
        }
        async function signer() {
          if (state) return state;
          const config = credentials() as Config;
          const keys = new keyStores.InMemoryKeyStore();
          let key: KeyPair;
          try {
            if (!config.secretKey.startsWith('ed25519:')) throw new Error();
            key = KeyPair.fromString(config.secretKey as Parameters<typeof KeyPair.fromString>[0]);
          } catch { throw new Error('QA_INVALID_STARTUP_KEY'); }
          await keys.setKey('testnet', config.accountId, key);
          const connection = Connection.fromConfig({ networkId: 'testnet', provider: { type: 'JsonRpcProvider', args: { url: config.rpcUrl } }, signer: { type: 'InMemorySigner', keyStore: keys } });
          state = { accountId: config.accountId, rpcUrl: config.rpcUrl, account: new QaAccount(connection, config.accountId), publicKey: key.getPublicKey(), allowedMarketIds: config.allowedMarketIds, allowedMethods: config.allowedMethods };
          delete window.__KOTOBA_QA_SIGNER__;
          return state;
        }
        async function getAccounts() {
          if (sessionStorage.getItem(CONNECTED) !== '1') return [];
          const s = await signer();
          return [{ accountId: s.accountId, publicKey: s.publicKey.toString() }];
        }
        async function send(params: SignAndSendTransactionParams) {
          if (sessionStorage.getItem(CONNECTED) !== '1') throw new Error('QA_SIGN_IN_REQUIRED');
          const s = await signer();
          const receiver = params.receiverId ?? contractId;
          if (!receiver) throw new Error('QA_CONTRACT_REQUIRED');
          requireTestnet(receiver);
          if (receiver !== contractId || (params.signerId && params.signerId !== s.accountId)) throw new Error('QA_ACCOUNT_MISMATCH');
          let deposit = 0n, gas = 0n;
          const methods: string[] = [];
          const actions = params.actions.map(action => {
            // Wallet Selector 10 supplies near-js Actions; also accept its older FunctionCall shape.
            const a = action as unknown as { functionCall?: { methodName: string; args: Uint8Array; gas: bigint; deposit: bigint }; type?: string; params?: { methodName: string; args: object; gas: string; deposit: string } };
            const call = a.functionCall ?? (a.type === 'FunctionCall' ? a.params : undefined);
            if (!call) throw new Error('QA_FUNCTION_CALL_ONLY');
            const args = call.args instanceof Uint8Array ? JSON.parse(new TextDecoder().decode(call.args)) : call.args;
            if (s.allowedMethods && !s.allowedMethods.includes(call.methodName)) throw new Error('QA_METHOD_NOT_ALLOWED');
            if (s.allowedMarketIds && !s.allowedMarketIds.includes((args as { id?: string }).id ?? '')) throw new Error('QA_MARKET_NOT_ALLOWED');
            const d = BigInt(call.deposit), g = BigInt(call.gas);
            if (d < 0n || g <= 0n || g > 300_000_000_000_000n) throw new Error('QA_INVALID_CALL_BUDGET');
            deposit += d; gas += g; methods.push(call.methodName);
            return transactions.functionCall(call.methodName, call.args, g, d);
          });
          if (!actions.length) throw new Error('QA_ACTION_REQUIRED');
          const price = await rpc(s.rpcUrl, 'gas_price', [null]);
          const gasPrice = BigInt(price.gas_price);
          if (gasPrice <= 0n || gasPrice > 1_000_000_000n) throw new Error('QA_GAS_PRICE_OUT_OF_BOUNDS');
          // Prepaid gas is refunded when unused. Reserve twice the current chain price
          // for spending; keep the app's stricter balance allowance independently.
          const spendReservation = deposit + gas * gasPrice * 2n + 10n ** 21n;
          const need = deposit + gas * 1_000_000_000n + 10n ** 21n;
          if (reserved + spendReservation > CAP) throw new Error('QA_SPEND_CAP_0_3_NEAR');
          const balance = await rpc(s.rpcUrl, 'query', { request_type: 'view_account', finality: 'final', account_id: s.accountId });
          if (BigInt(balance.amount) - BigInt(balance.storage_usage) * 10n ** 19n < need) throw new Error('QA_LOW_TESTNET_BALANCE');
          reserved += spendReservation; sessionStorage.setItem('kotoba-qa-reserved', reserved.toString());
          const [hashBytes, signed] = await s.account.signCall(receiver, actions);
          const hash = utils.serialize.base_encode(hashBytes);
          const event = { hash, accountId: s.accountId, receiverId: receiver, methods, depositYocto: deposit.toString(), gas: gas.toString() };
          const report = (stage: string, extra = {}) => window.__KOTOBA_QA_REPORT_TX__!({ ...event, stage, at: new Date().toISOString(), ...extra });
          await report('signed'); // Persist only public evidence in Node before broadcasting.
          try { await rpc(s.rpcUrl, 'send_tx', { signed_tx_base64: Buffer.from(signed.encode()).toString('base64'), wait_until: 'NONE' }); }
          catch { await report('broadcast_uncertain'); } // Never sign again after a timeout.
          for (let i = 0; i < 30; i++) {
            let outcome;
            try { outcome = await rpc(s.rpcUrl, 'tx', { tx_hash: hash, sender_account_id: s.accountId, wait_until: 'FINAL' }); } catch {}
            if (outcome?.status && outcome.final_execution_status === 'FINAL') {
              const receipts = [outcome.transaction_outcome, ...(outcome.receipts_outcome ?? [])];
              const failed = [outcome.status, ...receipts.map(r => r.outcome.status)].some(status => status?.Failure);
              const gasBurntYocto = receipts.reduce((n, r) => n + BigInt(r.outcome.tokens_burnt), 0n).toString();
              await report(failed ? 'failed' : 'final', { gasBurntYocto });
              return outcome;
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          await report('finality_timeout');
          throw new Error(`Transaction ${hash} doesn't exist yet; QA finality timeout`);
        }
        const unavailable = async () => { throw new Error('QA_UNSUPPORTED_SIGNER_METHOD'); };
        const behaviour = {
          async signIn(params: { contractId?: string }) {
            if (!params.contractId) throw new Error('QA_CONTRACT_REQUIRED');
            requireTestnet(params.contractId);
            if (params.contractId !== contractId) throw new Error('QA_ACCOUNT_MISMATCH');
            await signer(); sessionStorage.setItem(CONNECTED, '1'); return getAccounts();
          },
          async signOut() { sessionStorage.removeItem(CONNECTED); },
          getAccounts,
          signAndSendTransaction(params: SignAndSendTransactionParams) {
            const result = queue.then(() => send(params)); queue = result.catch(() => {}); return result;
          },
          async signAndSendTransactions({ transactions: txs }: { transactions: SignAndSendTransactionParams[] }) {
            const outcomes = []; for (const tx of txs) outcomes.push(await behaviour.signAndSendTransaction(tx)); return outcomes;
          },
          async getPublicKey() { return (await signer()).publicKey; },
          verifyOwner: unavailable, signMessage: unavailable, signNep413Message: unavailable, signTransaction: unavailable,
        };
        // near-api-js 5 and Wallet Selector 10 use separate near-js type versions. Only the common wallet port is used.
        return behaviour as unknown as Omit<InjectedWallet, 'id' | 'type' | 'metadata'>;
      },
    };
  };
}
