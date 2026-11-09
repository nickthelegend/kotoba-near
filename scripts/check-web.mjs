import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('/Volumes/Extreme SSD/Projects/tasteprobe/node_modules/playwright-core');

const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const base = process.env.KOTOBA_WEB || 'http://127.0.0.1:5198';
  for (const route of ['/', '/app', '/resolved', '/you', '/market/fomc-2026-01-inflation-40', '/creators']) for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base + route, { waitUntil: 'networkidle' });
    const state = await page.evaluate(() => ({
      rootText: document.querySelector('#root')?.textContent?.trim() || '',
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth,
    }));
    if (!state.rootText) throw new Error(`${route} ${width}px root is empty`);
    if (errors.length) throw new Error(`${route} ${width}px page errors: ${errors.join('; ')}`);
    if (state.scrollWidth > state.innerWidth) throw new Error(`${route} ${width}px horizontal overflow: ${state.scrollWidth} > ${state.innerWidth}`);
    console.log(`${route} ${width}px: rendered, 0 page errors, no horizontal overflow`);
    await page.close();
  }
} finally { await browser.close(); }
