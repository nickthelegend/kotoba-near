import { fetchOfficialPdf } from '../src/index.mjs';

const [url, expected] = process.argv.slice(2);
if (!url || !/^[a-f0-9]{64}$/i.test(expected || '')) {
  throw new Error('Usage: node packages/sdk/scripts/verify-transcript.mjs <official-Fed-PDF-URL> <expected-SHA256>');
}
const result = await fetchOfficialPdf(url);
if (result.transcript_sha256 !== expected.toLowerCase()) {
  throw new Error(`Transcript hash mismatch: observed ${result.transcript_sha256}`);
}
console.log(JSON.stringify({ source_url: url, transcript_sha256: result.transcript_sha256, verified: true }, null, 2));
