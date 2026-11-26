// End-to-end rehearsal: one host screen, two real phones, six bots.
// Plays the whole game in a real browser and saves screenshots.
//   PORT=3100 ANSWER_SECONDS=5 node server.js &
//   node test/e2e.mjs http://localhost:3100 out-dir
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import fs from 'node:fs';

const BASE = process.argv[2] || 'http://localhost:3100';
const OUT = process.argv[3] || 'e2e-shots';
const SPEED = Number(process.env.SPEED || 4);
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const errors = [];
const hostCtx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
const host = await hostCtx.newPage();
host.on('pageerror', (e) => errors.push('host: ' + e.message));
host.on('console', (m) => { if (m.type() === 'error') errors.push('host console: ' + m.text()); });
await host.goto(`${BASE}/host?new&speed=${SPEED}&bots=6`);
await host.waitForFunction(() => /^\d{4}$/.test(document.querySelector('#join-code')?.textContent || ''));
const code = await host.textContent('#join-code');
console.log('game code', code);

const phones = [];
for (const name of ['Seed', 'Alex']) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(`${name}: ` + e.message));
  await p.goto(`${BASE}/join/${code}`);
  await p.fill('#pname', name);
  await p.click('form.join button');
  await p.waitForSelector('.v-lobby');
  phones.push({ name, p });
}
await host.waitForTimeout(3000 / SPEED + 800);
await host.screenshot({ path: `${OUT}/01-lobby.png` });
await phones[0].p.screenshot({ path: `${OUT}/01-phone-lobby.png` });

await host.click('.start-btn');
let shot = 2;
const seen = new Set();
const deadline = Date.now() + 8 * 60_000;
while (Date.now() < deadline) {
  // Phones answer whenever answering is open.
  for (const [i, { p, name }] of phones.entries()) {
    if (await p.$('.v-answer')) {
      const key = `${name}-${await host.evaluate(() => document.querySelector('.zone.live')?.id)}-${await p.textContent('.answer .q')}`;
      if (!seen.has(key)) {
        seen.add(key);
        if (i === 0 && await p.$('[data-act="hint"]:not([disabled])')) {
          await p.click('[data-act="hint"]');
          await p.waitForSelector('.hinttext', { timeout: 3000 }).catch(() => {});
        }
        const choices = await p.$$('[data-pick]');
        if (choices.length) await choices[(i + seen.size) % choices.length].click();
        // Double the bet chip once or twice (the second phone keeps the default).
        if (i === 0) for (let k = 0; k < 1 + (seen.size % 2); k++) { const d = await p.$('[data-act="double"]:not([disabled])'); if (d) await d.click(); }
        if (shot < 40 && i === 0) await p.screenshot({ path: `${OUT}/${String(shot).padStart(2, '0')}-phone-answer.png` });
        await p.click('[data-act="lock"]');
      }
    }
  }
  const nextVisible = await host.$('.hud-next:not([hidden])');
  if (nextVisible) {
    const label = (await host.textContent('.hud-next span')).trim();
    await host.waitForTimeout(600);
    await host.screenshot({ path: `${OUT}/${String(shot).padStart(2, '0')}-host-${label.replace(/\W+/g, '_')}.png` });
    await phones[0].p.screenshot({ path: `${OUT}/${String(shot).padStart(2, '0')}-phone.png` });
    shot++;
    if (label === 'Back to the start') break;
    await host.keyboard.press('Space');
  }
  await host.waitForTimeout(250);
}

const final = await phones[0].p.textContent('main');
console.log('phone final:', final.replace(/\s+/g, ' ').trim());
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
if (errors.length) process.exit(1);
