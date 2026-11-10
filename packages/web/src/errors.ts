// Maps real failure shapes (contract panics, NEAR RPC errors, wallet popups, OutLayer) to a message a player can act on.
// Every shape handled here was captured from NEAR testnet; see test/fixtures/testnet-errors.json and scripts/capture-errors.mjs.
// No imports, so `node --test` can load it directly.

export type ErrorKind =
  | 'wallet_not_connected' | 'user_rejected' | 'popup_blocked' | 'network_mismatch' | 'unknown_account'
  | 'insufficient_balance' | 'storage_balance' | 'access_key_allowance' | 'nonce'
  | 'quantity' | 'closed' | 'price_moved' | 'unknown_market' | 'not_final' | 'no_winning_shares' | 'state'
  | 'resolution_time' | 'window' | 'bond' | 'not_void' | 'no_shares' | 'private_method'
  | 'market_id' | 'source' | 'event' | 'phrase' | 'parameters' | 'time' | 'subsidy'
  | 'rate_limited' | 'rpc_down' | 'tx_not_found' | 'tx_timeout' | 'attestation_pending' | 'contract' | 'unknown';

export type Explained = {
  kind: ErrorKind;
  /** One line: what happened. */
  title: string;
  /** What it means, in plain words. */
  detail: string;
  /** What the player can do next. */
  next: string;
  /** The contract's own panic string or the RPC error name, shown verbatim. */
  code?: string;
  /** A transaction hash, when the failure landed on chain. */
  tx?: string;
  /** Whether trying the same thing again can succeed. */
  retry: boolean;
};

/** Thrown by the RPC client so the HTTP status and JSON-RPC error survive to the mapper. */
export class RpcError extends Error {
  status?: number; rpcName?: string; causeName?: string; data?: string;
  constructor(message: string, o: { status?: number; rpcName?: string; causeName?: string; data?: string } = {}) {
    super(message); this.name = 'RpcError'; Object.assign(this, o);
  }
}
/** The error in a JSON-RPC response (HTTP status, `error`, or a view call's `result.error`), or null when it succeeded. */
export function rpcErrorFrom(body: unknown, status = 200): RpcError | null {
  const b = body as { error?: { code?: number; name?: string; message?: string; data?: unknown; cause?: { name?: string } }; result?: { error?: string } } | null;
  if (status === 429 || b?.error?.code === -429) return new RpcError(`NEAR RPC rate limited (HTTP ${status === 429 ? 429 : '200, code -429'})`, { status: 429 });
  if (status >= 400) return new RpcError(`NEAR RPC HTTP ${status}`, { status });
  if (b?.error) {
    const data = typeof b.error.data === 'string' ? b.error.data : JSON.stringify(b.error.data ?? '');
    return new RpcError(data || b.error.message || 'NEAR RPC rejected the request', { status, rpcName: b.error.name, causeName: b.error.cause?.name, data });
  }
  if (b?.result?.error) return new RpcError(b.result.error, { status });
  return null;
}
/** Thrown when a transaction landed and failed; carries the hash for the explorer link. */
export class TxFailed extends Error {
  tx: string;
  constructor(message: string, tx: string) { super(message); this.name = 'TxFailed'; this.tx = tx; }
}

/** The contract's panic message from any NEAR error text ("Smart contract panicked: X" or a view call's GuestPanic). */
export function panicOf(text: string): string | null {
  const m = text.match(/Smart contract panicked: ((?:\\.|[^"\\])*)/) ?? text.match(/panic_msg: "((?:\\.|[^"\\])*)/);
  if (!m) return null;
  // near-sdk's `expect` prefixes the source location: "panicked at src/lib.rs:98:48:\nERR_UNKNOWN_MARKET".
  return m[1].replace(/\\n/g, '\n').replace(/^panicked at [^\n]*:\n/, '').replace(/\\"/g, '"').trim();
}

/** The failure inside an RPC `tx` result (status.Failure), or null when the transaction and every receipt succeeded. */
export function txFailure(result: unknown): string | null {
  const r = result as { status?: { Failure?: unknown }; receipts_outcome?: { outcome?: { status?: { Failure?: unknown } } }[] } | null;
  if (!r) return null;
  const f = r.status?.Failure ?? r.receipts_outcome?.find((o) => o.outcome?.status?.Failure)?.outcome?.status?.Failure;
  if (!f) return null;
  const s = JSON.stringify(f);
  return panicOf(s) ?? s;
}

const CONTRACT: Record<string, Omit<Explained, 'kind' | 'code' | 'tx' | 'retry'> & { kind: ErrorKind; retry?: boolean }> = {
  ERR_DEPOSIT: { kind: 'price_moved', title: 'The price moved before your bet landed', detail: 'The contract priced the shares above what you attached, so nothing was bought. Your deposit came back, minus a little gas.', next: 'Get a fresh quote and buy again.', retry: true },
  ERR_CLOSED: { kind: 'closed', title: 'Bets on this market are closed', detail: 'Betting stops before the press conference starts, and once a result is posted.', next: 'Pick an open market on the board.' },
  ERR_QUANTITY: { kind: 'quantity', title: 'Choose between 1 and 100,000 shares', detail: 'The contract only accepts whole-share orders from 1 to 100,000.', next: 'Change the number of shares.' },
  ERR_UNKNOWN_MARKET: { kind: 'unknown_market', title: 'This market does not exist on the contract', detail: 'No market with this id is stored on the Kotoba contract.', next: 'Go back to the board and pick a listed market.' },
  ERR_NOT_FINAL: { kind: 'not_final', title: 'Winnings are not claimable yet', detail: 'Claims open once the attested result is final: after the challenge window, someone must call finalize.', next: 'Finalize the market (if its window has passed), then claim.' },
  ERR_NO_WINNING_SHARES: { kind: 'no_winning_shares', title: 'No winning shares to claim', detail: 'This account holds no shares on the winning side. They may already be claimed, or they are on the losing side.', next: 'Check your positions; nothing more is owed here.' },
  ERR_STATE: { kind: 'state', title: 'The market is busy or already settled', detail: 'Resolution or a challenge is already running in OutLayer, or the market has moved past this step.', next: 'Wait a minute and refresh the market.', retry: true },
  ERR_RESOLUTION_TIME: { kind: 'resolution_time', title: 'Not inside the resolution window', detail: 'A market can be resolved only between its close and its resolution deadline.', next: 'Wait for bets to close, or claim a refund if the deadline has passed.' },
  ERR_WINDOW: { kind: 'window', title: 'Outside the challenge window', detail: 'Challenges are accepted only while the window is open, and finalize only after it closes.', next: 'Refresh the market to see which step is available now.' },
  ERR_RESOLVER_BOND: { kind: 'bond', title: 'Bond too small', detail: 'Resolving needs more than the 0.1 NEAR bond, plus OutLayer’s execution fee.', next: 'Attach at least 0.12 NEAR.' },
  ERR_BOND: { kind: 'bond', title: 'Bond too small', detail: 'Challenging needs more than the 0.1 NEAR bond, plus OutLayer’s execution fee.', next: 'Attach at least 0.12 NEAR.' },
  ERR_NOT_VOID: { kind: 'not_void', title: 'This market is not void', detail: 'Refunds open only if no attested result settled the market by its deadline.', next: 'Claim normally once it is final.' },
  ERR_NO_SHARES: { kind: 'no_shares', title: 'No shares to refund', detail: 'This account holds no shares in this market, or the refund was already paid.', next: 'Nothing more is owed here.' },
  ERR_MARKET_ID: { kind: 'market_id', title: 'That market already exists', detail: 'Market ids are unique, and use lowercase letters, digits and dashes (64 at most).', next: 'Change the word, the date or the count.' },
  ERR_SOURCE: { kind: 'source', title: 'Source not allowed', detail: 'Only federalreserve.gov FOMC press conference PDFs can be counted.', next: 'Pick a press conference date.' },
  ERR_EVENT: { kind: 'event', title: 'Event name invalid', detail: 'The event name must be 1 to 120 characters.', next: 'Shorten the event name.' },
  ERR_PHRASE: { kind: 'phrase', title: 'Word or phrase not countable', detail: 'Use letters and single spaces only, up to 40 characters.', next: 'Edit the phrase.' },
  ERR_PARAMETERS: { kind: 'parameters', title: 'Count or liquidity out of range', detail: 'The count must be at least 1 and liquidity b between 100 and 100,000.', next: 'Adjust the numbers.' },
  ERR_TIME: { kind: 'time', title: 'That press conference has already started', detail: 'Bets must close in the future, before the resolution deadline.', next: 'Pick an upcoming FOMC date.' },
  ERR_SUBSIDY: { kind: 'subsidy', title: 'Subsidy too small', detail: 'Opening a market seeds b·ln2 × 0.001 NEAR so the AMM always has a price.', next: 'Attach the subsidy shown.' },
};

const near = (s: string) => Number(s).toFixed(4).replace(/\.?0+$/, '');

/** The one place every error turns into words. */
export function explain(e: unknown): Explained {
  const err = e as { message?: unknown; type?: unknown; name?: unknown; tx?: unknown; status?: unknown; rpcName?: unknown; causeName?: unknown; context?: { transactionHash?: string }; transaction_outcome?: { id?: string } };
  const message = typeof e === 'string' ? e : typeof err?.message === 'string' ? err.message : JSON.stringify(e ?? '');
  const type = typeof err?.type === 'string' ? err.type : '';
  const cause = typeof err?.causeName === 'string' ? err.causeName : '';
  // A hash only counts when the transaction landed (ActionError or TxFailed); InvalidTxError hashes never reach the chain.
  const tx = typeof err?.tx === 'string' ? err.tx : type === 'ActionError' ? err?.transaction_outcome?.id : undefined;
  const out = (x: Omit<Explained, 'retry'> & { retry?: boolean }): Explained => ({ retry: false, ...x, ...(tx && !x.tx ? { tx } : {}) });

  // TxFailed carries the bare panic string already extracted by txFailure.
  const panic = panicOf(message) ?? (e instanceof TxFailed || /^(ERR_[A-Z_]+|Method \w+ is private)/.test(message) ? message : null);
  if (panic) {
    const code = panic.match(/ERR_[A-Z_]+/)?.[0];
    const known = code ? CONTRACT[code] : undefined;
    if (known) return out({ ...known, code, retry: known.retry ?? false });
    if (/Method \w+ is private/.test(panic)) return out({ kind: 'private_method', title: 'Only the contract can call this', detail: 'This step is a callback that only the Kotoba contract itself may call.', next: 'Use Resolve or Challenge instead.', code: panic });
    return out({ kind: 'contract', title: 'The contract rejected the transaction', detail: panic, next: 'Refresh and check the market state.', code: panic });
  }

  // Balance problems, from the RPC (InvalidTxError) or the wallet.
  const bal = message.match(/does not have enough balance ([\d.]+) for operation costing ([\d.]+)/);
  if (type === 'NotEnoughBalance' || bal) return out({ kind: 'insufficient_balance', title: 'Not enough testnet NEAR', detail: bal ? `This account holds ${near(bal[1])} NEAR, but the transaction needs ${near(bal[2])} NEAR up front (deposit plus prepaid gas; unused gas comes back).` : 'The account cannot cover the deposit plus prepaid gas.', next: 'Lower the amount, or top up the account from a testnet faucet.', code: 'NotEnoughBalance', tx: undefined });
  if (type === 'LackBalanceForState' || /LackBalanceForState|wouldn't have enough balance to cover storage/.test(message)) return out({ kind: 'storage_balance', title: 'Balance is locked for storage', detail: 'NEAR keeps part of every balance locked to pay for the account’s storage, so it cannot be spent.', next: 'Top up the account, then try again.', code: 'LackBalanceForState' });
  if (type === 'NotEnoughAllowance' || /NotEnoughAllowance|does not have enough allowance/i.test(message)) return out({ kind: 'access_key_allowance', title: 'The app’s signing key ran out of allowance', detail: 'MyNearWallet gave this site a key with a small gas allowance, and it is used up.', next: 'Sign out and connect again to get a fresh key.', code: 'NotEnoughAllowance' });
  if (/InvalidNonce|Expired|nonce/i.test(type + message)) return out({ kind: 'nonce', title: 'The transaction went stale', detail: 'Another transaction from this account landed first, or the block reference expired.', next: 'Send it again.', code: type || 'InvalidNonce', retry: true });

  // Wallet popup (MyNearWallet via wallet-selector 9.5).
  if (/User closed the window|reject|denied|cancel/i.test(message)) return out({ kind: 'user_rejected', title: 'You closed the wallet without approving', detail: 'Nothing was signed and nothing was sent.', next: 'Try again and approve it in MyNearWallet.', retry: true });
  if (/Popup window blocked/i.test(message)) return out({ kind: 'popup_blocked', title: 'Your browser blocked the wallet window', detail: 'MyNearWallet opens in a popup to sign.', next: 'Allow popups for this site, then try again.', retry: true });
  if (/Wallet not signed in|No wallet selected|not signed in/i.test(message)) return out({ kind: 'wallet_not_connected', title: 'Connect a wallet first', detail: 'Bets are signed by your NEAR testnet account.', next: 'Connect with MyNearWallet.' });
  if (/^NETWORK_MISMATCH/.test(message)) return out({ kind: 'network_mismatch', title: 'That is a mainnet account', detail: message.replace(/^NETWORK_MISMATCH:\s*/, ''), next: 'Sign out and connect a .testnet account.' });

  // RPC transport and lookups.
  if (cause === 'UNKNOWN_ACCOUNT' || /does not exist while viewing/.test(message)) {
    const id = message.match(/account (\S+) does not exist/)?.[1] ?? '';
    if (id.endsWith('.near')) return out({ kind: 'network_mismatch', title: 'That is a mainnet account', detail: `${id} is a mainnet name; Kotoba runs on NEAR testnet, where it does not exist.`, next: 'Sign out and connect a .testnet account.', code: 'UNKNOWN_ACCOUNT' });
    return out({ kind: 'unknown_account', title: 'Account not found on NEAR testnet', detail: `${id || 'This account'} does not exist on testnet yet.`, next: 'Create a free testnet account in MyNearWallet, then connect it.', code: 'UNKNOWN_ACCOUNT' });
  }
  if (cause === 'UNKNOWN_TRANSACTION' || /Transaction \S+ doesn't exist/.test(message)) return out({ kind: 'tx_not_found', title: 'The network has not seen this transaction yet', detail: 'It was just submitted; RPC nodes can take a few seconds to index it.', next: 'Keep this page open; it re-checks automatically.', code: 'UNKNOWN_TRANSACTION', retry: true });
  if (/^TX_TIMEOUT/.test(message)) return out({ kind: 'tx_timeout', title: 'Still waiting for confirmation', detail: 'The transaction was sent but no result came back in time. It may still land.', next: 'Open it in NearBlocks before sending it again.', retry: false });
  if (err?.status === 429 || /\b429\b|rate.?limit|TOO_MANY_REQUESTS/i.test(message)) return out({ kind: 'rate_limited', title: 'The NEAR RPC is rate-limiting us', detail: 'Public testnet RPC nodes cap requests per IP. Both endpoints answered “too many requests”.', next: 'Wait a few seconds and retry.', code: 'HTTP 429', retry: true });
  if (/OutLayer attestation API HTTP 404/.test(message)) return out({ kind: 'attestation_pending', title: 'The TEE attestation is not published yet', detail: 'OutLayer posts the attestation for an execution after it finishes. This one is not available yet.', next: 'Retry in a minute.', code: 'HTTP 404', retry: true });
  if (/Failed to fetch|fetch failed|NetworkError|Load failed|unreachable|HTTP 5\d\d/i.test(message)) return out({ kind: 'rpc_down', title: 'Cannot reach NEAR testnet', detail: 'Neither RPC endpoint answered. Your connection may be offline, or the public nodes are down.', next: 'Check your connection and retry.', code: message.match(/HTTP \d{3}/)?.[0], retry: true });

  return out({ kind: 'unknown', title: 'Something went wrong', detail: message || 'Unknown error', next: 'Retry. If it keeps happening, the raw error above says what failed.', retry: true });
}

/** The prepaid cost NEAR checks before accepting a transaction: deposit + tgas × 0.001 NEAR + ~0.001 NEAR of action fees.
 * Calibrated on testnet (Nov 10): 30/100/300 Tgas calls were rejected as costing deposit + 0.0309/0.1009/0.3009 NEAR. */
export function upfrontYocto(depositYocto: bigint, tgas: number) {
  return depositYocto + BigInt(tgas) * 10n ** 21n + 10n ** 21n;
}
/** Spendable balance: total minus the part NEAR locks for storage (1e19 yocto per byte). */
export function spendableYocto(amount: string, storageUsage: number) {
  const s = BigInt(amount) - BigInt(storageUsage) * 10n ** 19n;
  return s > 0n ? s : 0n;
}
/** Whole-share quantity as typed: null when valid, else the inline message. */
export function quantityError(raw: string): string | null {
  if (raw.trim() === '') return 'Enter how many shares to buy';
  if (!/^\d+$/.test(raw.trim())) return 'Whole shares only (no decimals or signs)';
  const n = Number(raw);
  if (n < 1) return 'Buy at least 1 share';
  if (n > 100_000) return 'At most 100,000 shares per order';
  return null;
}
