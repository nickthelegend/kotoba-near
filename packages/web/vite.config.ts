import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The art folder is listed at build time so the app only references images that exist.
// Restart the dev server after adding art.
const art = readdirSync(resolve(import.meta.dirname, 'public/art')).filter((f) => /\.(png|webp|jpe?g)$/i.test(f)).sort();
export default defineConfig({ plugins: [react()], define: { __ART__: JSON.stringify(art) } });
