import account from '../../../deployments/book-account-2026-11-13.json';
export const BOOK_CONTRACT=account.account;
export const BOOK_RPC='https://test.rpc.fastnear.com';
export const UNIT=10n**21n, CENT=UNIT/100n, STORAGE=5n*UNIT;
export type Order={order_id:number;market_id:string;owner:string;yes:boolean;buy:boolean;price:number;quantity:number;remaining:number;created_ns:number;cancelled:boolean};
export type Trade={trade_id:number;market_id:string;yes:boolean;price:number;quantity:number;maker:string;taker:string;maker_order:number;taker_order:number;taker_buy:boolean;at_ns:number};
export type Book={bids:Order[];asks:Order[];last_price:number|null;spread:number|null;storage_fee:string;payout:string};
export type Mention={id:string;phrase:string;event:string;source_url:string;threshold:number;status:string;close_ns:number;deadline_ns:number;result:{count:number}|null};
export async function bookView<T>(method_name:string,args:object={}):Promise<T>{let last:unknown;for(const url of [BOOK_RPC,'https://near-testnet.drpc.org']){try{const r=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:'kotoba-book',method:'query',params:{request_type:'call_function',finality:'final',account_id:BOOK_CONTRACT,method_name,args_base64:btoa(JSON.stringify(args))}}),signal:AbortSignal.timeout(15000)});const b=await r.json();if(!r.ok||b.error||b.result?.error)throw Error('NEAR testnet is unavailable. Try again.');return JSON.parse(new TextDecoder().decode(Uint8Array.from(b.result.result)));}catch(e){last=e}}throw last;}
export const coin=(x:bigint|number|string)=>`${(Number(x)/1e24).toLocaleString('en-US',{maximumFractionDigits:6})} NEAR`;
export const txURL=(hash:string)=>`https://nearvalidate.org/txns/${hash}?network=testnet`;
export function quotePrice(b:Book|undefined){return b?.last_price??null}
