import { Buffer } from 'buffer';
const g = globalThis as unknown as { Buffer?: typeof Buffer; global?: unknown; process?: { env: Record<string, string | undefined> } };
g.Buffer ??= Buffer;
g.global ??= globalThis;
// The wallet SDK reads DEFAULT_FINALITY while its browser module initializes.
// Leave it unset so the SDK uses its own default, without exposing server environment variables.
g.process ??= { env: {} };
