// Development-only approval sheet for the QA signer (imported only by qa-signer.ts, which production builds drop).
// Before the QA signer signs anything it shows what is about to be signed and waits for Approve or Reject,
// the same step a real wallet popup gives. Plain DOM so it works outside React and over any route.
import { describeCall } from './qa-describe';

export type ApprovalRequest = { accountId: string; receiverId: string; origin: string; calls: { method: string; args: Record<string, unknown>; deposit: bigint; gas: bigint }[] };

const CSS = `
.kq-scrim { position: fixed; inset: 0; z-index: 2147483000; background: rgba(21, 18, 15, .38); display: grid; place-items: center; padding: 16px; animation: kq-fade .18s ease-out; font-family: 'Urbanist', system-ui, sans-serif; color: #15120f; font-variant-numeric: tabular-nums; }
.kq-sheet { width: min(440px, 100%); background: #fff; border-radius: 22px; box-shadow: 0 2px 6px rgba(30, 20, 10, .08), 0 24px 64px rgba(30, 20, 10, .22); overflow: hidden; animation: kq-rise .24s cubic-bezier(.2, .8, .2, 1); }
.kq-head { display: flex; align-items: center; gap: 12px; padding: 18px 20px 14px; border-bottom: 1px solid #e7e2da; }
.kq-mark { width: 34px; height: 34px; border-radius: 10px; background: #ff5a4e; color: #2a0d09; display: grid; place-items: center; font-weight: 700; font-size: 18px; flex: none; }
.kq-head h2 { margin: 0; font-size: 19px; font-weight: 700; letter-spacing: -.02em; line-height: 1.15; }
.kq-head small { display: block; color: #787066; font-size: 13px; font-weight: 500; }
.kq-test { margin-left: auto; align-self: flex-start; font-size: 11px; font-weight: 600; color: #787066; background: #f1eee9; padding: 3px 8px; border-radius: 6px; white-space: nowrap; }
.kq-what { margin: 16px 20px 4px; padding: 14px 16px; border-radius: 14px; background: #f6f4f0; }
.kq-what b { display: block; font-size: 18px; font-weight: 700; letter-spacing: -.015em; }
.kq-what span { display: block; margin-top: 4px; font-size: 14px; color: #3b352f; line-height: 1.35; }
.kq-rows { margin: 10px 20px 0; display: grid; }
.kq-row { display: flex; justify-content: space-between; align-items: baseline; gap: 16px; padding: 9px 0; border-bottom: 1px solid #f1eee9; font-size: 14px; }
.kq-row:last-child { border-bottom: 0; }
.kq-row dt { color: #787066; font-weight: 500; white-space: nowrap; }
.kq-row dd { margin: 0; text-align: right; font-weight: 600; overflow-wrap: anywhere; }
.kq-row code { font-family: 'Space Mono', ui-monospace, monospace; font-size: 13px; }
.kq-net { display: inline-flex; align-items: center; gap: 6px; }
.kq-net i { width: 7px; height: 7px; border-radius: 50%; background: #14a067; box-shadow: 0 0 0 3px rgba(20, 160, 103, .15); }
.kq-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; padding: 16px 20px 20px; }
.kq-actions button { height: 48px; border-radius: 999px; border: 0; font: inherit; font-size: 16px; font-weight: 700; cursor: pointer; transition: transform .15s, background .15s; }
.kq-actions button:active { transform: scale(.98); }
.kq-reject { background: #f1eee9; color: #15120f; }
.kq-reject:hover { background: #e7e2da; }
.kq-approve { background: #15120f; color: #fff; }
.kq-approve:hover { background: #2c2722; }
.kq-approve:disabled { opacity: .6; cursor: progress; }
@keyframes kq-fade { from { opacity: 0; } }
@keyframes kq-rise { from { opacity: 0; transform: translateY(14px) scale(.98); } }
@media (max-width: 640px) {
  .kq-scrim { place-items: end center; padding: 0; }
  .kq-sheet { width: 100%; border-radius: 22px 22px 0 0; padding-bottom: env(safe-area-inset-bottom); animation-name: kq-up; }
  @keyframes kq-up { from { transform: translateY(100%); } }
}`;

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
};

/** Shows the sheet and resolves true on Approve, false on Reject, Escape or a click outside. */
export function askApproval(req: ApprovalRequest): Promise<boolean> {
  if (!document.getElementById('kq-style')) { const s = el('style'); s.id = 'kq-style'; s.textContent = CSS; document.head.append(s); }
  const scrim = el('div', 'kq-scrim');
  const sheet = el('div', 'kq-sheet');
  sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-modal', 'true'); sheet.setAttribute('aria-labelledby', 'kq-title');
  const head = el('div', 'kq-head');
  const titles = el('div');
  const h = el('h2', undefined, 'Approve transaction'); h.id = 'kq-title';
  titles.append(h, el('small', undefined, `Requested by ${req.origin}`));
  head.append(el('span', 'kq-mark', '言'), titles, el('span', 'kq-test', 'Test wallet'));
  sheet.append(head);
  const rows = el('dl', 'kq-rows');
  const row = (k: string, v: Node | string, mono = false) => {
    const r = el('div', 'kq-row'); const dd = el('dd');
    if (typeof v === 'string') dd.append(mono ? el('code', undefined, v) : v); else dd.append(v);
    r.append(el('dt', undefined, k), dd); rows.append(r);
  };
  const net = el('span', 'kq-net'); net.append(el('i'), 'NEAR testnet');
  row('Network', net);
  row('Signer', req.accountId, true);
  row('Contract', req.receiverId, true);
  for (const c of req.calls) {
    const s = describeCall(c.method, c.args, c.deposit, c.gas);
    const what = el('div', 'kq-what');
    what.append(el('b', undefined, s.title), ...s.detail.map(d => el('span', undefined, d)));
    sheet.append(what);
    row('Method', c.method, true);
    row('Deposit', s.deposit);
    row('Gas', s.gas);
  }
  sheet.append(rows);
  const actions = el('div', 'kq-actions');
  const reject = el('button', 'kq-reject', 'Reject'); reject.type = 'button';
  const approve = el('button', 'kq-approve', 'Approve'); approve.type = 'button';
  actions.append(reject, approve);
  sheet.append(actions);
  scrim.append(sheet);
  document.body.append(scrim);
  approve.focus({ preventScroll: true });
  return new Promise(resolve => {
    const done = (ok: boolean) => { removeEventListener('keydown', onKey, true); scrim.remove(); resolve(ok); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); done(false); } };
    addEventListener('keydown', onKey, true);
    reject.onclick = () => done(false);
    approve.onclick = () => { approve.disabled = true; approve.textContent = 'Signing…'; setTimeout(() => done(true), 180); };
    scrim.onclick = e => { if (e.target === scrim) done(false); };
  });
}
