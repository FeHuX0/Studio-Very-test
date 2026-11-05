import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

// Optional local QA helper; launch the app before running this script.
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE });
try {
  await mkdir('.artifacts', { recursive: true });
  for (const [name, width, height] of [['desktop',1440,960], ['compact',1280,800], ['mobile',390,844]]) {
    const page = await browser.newPage({ viewport: { width, height } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(process.env.FORMA_PREVIEW_URL || 'http://127.0.0.1:8000');
    await page.getByRole('img', { name:'Холст композиции' }).waitFor();
    await page.screenshot({ path:`.artifacts/studio-${name}.png`, fullPage:true });
    const layout = await page.evaluate(() => ({ width:innerWidth, documentWidth:document.documentElement.scrollWidth, svg:document.querySelector('.artboard')?.getBoundingClientRect().toJSON() }));
    console.log(JSON.stringify({name,layout,errors}));
    await page.close();
  }
} finally { await browser.close(); }
