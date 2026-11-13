// Plain-words reading of a Kotoba contract call, for the QA signer's approval sheet.
// Pure: it reads only the method, its JSON args, the deposit and the gas that are about to be signed.

export type CallSummary = { title: string; detail: string[]; deposit: string; gas: string };

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "fed-2026-12-09-inflation-30" -> { word: "Inflation", times: 30, date: "Dec 9" } */
export function marketName(id: string) {
  const m = id.match(/^[a-z]+-(\d{4})-(\d{2})-(\d{2})-(.+)$/);
  if (!m) return { word: id, times: 1, date: '' };
  const tail = m[4].match(/^(.*?)(?:-(\d+))?$/)!;
  const phrase = tail[1].replace(/-/g, ' ');
  const word = phrase === 'ai' ? 'AI' : phrase.replace(/\b\w/g, c => c.toUpperCase());
  return { word, times: tail[2] ? Number(tail[2]) : 1, date: `${MONTHS[Number(m[2]) - 1]} ${Number(m[3])}` };
}

/** yoctoNEAR -> "0.0045 NEAR" (exact up to 8 decimals; "1 yoctoNEAR" for the confirmation deposit). */
export function nearAmount(yocto: bigint) {
  if (yocto === 0n) return '0 NEAR';
  if (yocto < 10n ** 16n) return `${yocto} yoctoNEAR`;
  const n = Number(yocto / 10n ** 16n) / 1e8;
  return `${n.toLocaleString('en-US', { maximumFractionDigits: 8 })} NEAR`;
}

export function describeCall(method: string, args: Record<string, unknown>, deposit: bigint, gas: bigint): CallSummary {
  const tgas = `${(gas / 10n ** 12n).toString()} Tgas max, unused gas refunded`;
  if (method === 'place_order') {
    const { id, yes, buy, price, quantity, kind } = args as { id: string; yes: boolean; buy: boolean; price: number; quantity: number; kind: string };
    const m = marketName(String(id));
    const side = yes ? 'Yes' : 'No';
    const shares = `${quantity} ${side} share${quantity === 1 ? '' : 's'}`;
    const title = kind === 'limit'
      ? `${buy ? 'Bid' : 'Ask'} ${price}¢ for ${shares}`
      : buy ? `Buy ${shares} at up to ${price}¢` : `Sell ${shares} at ${price}¢ or more`;
    const market = `“${m.word}”${m.times > 1 ? ` said ${m.times}+ times` : ''}${m.date ? ` · ${m.date} press conference` : ''}`;
    const rest = kind === 'limit' ? `Fills at ${price}¢ or better; the rest waits in the book for a ${buy ? 'seller' : 'buyer'}` : 'Fills now against the book; any unfilled part comes back';
    return { title, detail: [market, rest], deposit: nearAmount(deposit), gas: tgas };
  }
  if (method === 'cancel_order') {
    const { order_id } = args as { order_id: number | string };
    return { title: `Cancel resting order #${order_id}`, detail: ['Its unfilled escrow comes straight back to you'], deposit: `${nearAmount(deposit)} (confirms it's you)`, gas: tgas };
  }
  return { title: `Call ${method}`, detail: [], deposit: nearAmount(deposit), gas: tgas };
}
