// Renders public/social.png (2560x1120) and public/assets/banner.png from an HTML card, so the
// image follows the landing page's sign: run `node scripts/social.mjs` after changing the
// headline. Needs the Playwright browsers (`pnpm exec playwright install chromium`).
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const require = createRequire(import.meta.url);
// Inlined: a page set with setContent has no origin, so file: fonts would not load.
const font = (name) =>
  `data:font/woff2;base64,${readFileSync(require.resolve(`@fontsource/${name.split('/')[0]}/files/${name.split('/')[1]}`)).toString('base64')}`;
// On the yellow sign the mark's top bar turns dark, as in the site header.
const mark = readFileSync(new URL('../public/assets/mark-on-light.svg', import.meta.url), 'utf8')
  .replaceAll('#3d3b36', '#0d0c0a')
  .replace('#f5c542', '#0d0c0a');

const lanes = [
  ['0', 'main', 'running', 'https://myapp.localhost'],
  ['1', 'feat/checkout', 'running', 'https://myapp1.localhost'],
  ['2', 'fix/login', 'idle', 'https://myapp2.localhost'],
  ['3', 'agent/perf', 'running', 'https://myapp3.localhost']
];
const colours = ['#c4a350', '#7c9fc6', '#a494be', '#78aaa7'];

const html = `<!doctype html>
<html><head><meta charset="utf-8"><style>
@font-face { font-family: Overpass; font-weight: 900; src: url(${font('overpass/overpass-latin-900-normal.woff2')}) format('woff2'); }
@font-face { font-family: Overpass; font-weight: 400; src: url(${font('overpass/overpass-latin-400-normal.woff2')}) format('woff2'); }
@font-face { font-family: 'JetBrains Mono'; font-weight: 400; src: url(${font('jetbrains-mono/jetbrains-mono-latin-400-normal.woff2')}) format('woff2'); }
@font-face { font-family: 'JetBrains Mono'; font-weight: 700; src: url(${font('jetbrains-mono/jetbrains-mono-latin-700-normal.woff2')}) format('woff2'); }
* { box-sizing: border-box; }
body { margin: 0; width: 1280px; height: 560px; background: #f5c542; color: #0d0c0a; font-family: Overpass, sans-serif; overflow: hidden; display: grid; grid-template-columns: 640px 1fr; padding: 48px 0 44px 64px; gap: 32px; }
.copy { display: flex; flex-direction: column; }
.brand { display: flex; align-items: center; gap: 12px; font: 700 26px 'JetBrains Mono', monospace; }
.brand svg { width: 40px; height: 40px; }
h1 { margin: 44px 0 26px; font: 900 64px/1.02 Overpass, sans-serif; letter-spacing: -0.035em; }
.sub { max-width: 560px; margin: 0; font-size: 24px; line-height: 1.4; color: #3a3000; }
.facts { margin: auto 0 0; font-size: 18px; color: #4a3f10; }
.term { align-self: end; margin-right: -60px; width: 640px; background: #1a1917; border: 1px solid rgba(255,255,255,.1); border-radius: 14px; box-shadow: 0 30px 70px -20px rgba(0,0,0,.6); font: 15px/1.6 'JetBrains Mono', monospace; color: #e8e6df; overflow: hidden; }
.bar { height: 42px; display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; padding: 0 16px; background: rgba(255,255,255,.04); border-bottom: 1px solid rgba(255,255,255,.07); font-size: 12px; color: #a9a396; }
.dots { display: flex; gap: 7px; } .dots i { width: 12px; height: 12px; border-radius: 50%; background: #4a463f; } .dots i:first-child { background: #f5c542; }
.cmd { padding: 18px 20px 6px; }
table { border-collapse: collapse; width: 100%; white-space: nowrap; }
th, td { text-align: left; padding: 9px 20px; font-weight: 400; }
thead { color: #a9a396; font-size: 11px; } thead th { border-bottom: 1px solid rgba(255,255,255,.08); }
tbody tr:first-child { background: rgba(245,197,66,.07); } tbody tr + tr { border-top: 1px dashed rgba(255,255,255,.07); }
.ok { color: #91c59f; } .dim { color: #8f8a7e; } td:last-child { color: #c5bfae; }
.mark { display: inline-block; width: 14px; height: 5px; border-radius: 3px; margin-right: 10px; vertical-align: middle; }
</style></head><body>
<div class="copy"><div class="brand">${mark}devlanes</div>
<h1>Run every worktree at once, each on its own localhost.</h1>
<p class="sub">An open source CLI that runs your dev stack once per Git worktree: own ports, own hostnames, own database.</p>
<p class="facts">Apache-2.0. macOS, Linux and Windows. devlanes.run</p></div>
<div class="term"><div class="bar"><span class="dots"><i></i><i></i><i></i></span><span>devlanes status</span><span></span></div>
<div class="cmd">$ devlanes status</div>
<table><thead><tr><th>LANE</th><th>BRANCH</th><th>STATE</th><th>URL</th></tr></thead><tbody>
${lanes
  .map(
    ([i, b, s, u]) =>
      `<tr><td><span class="mark" style="background:${colours[Number(i)]}"></span>${i}</td><td>${b}</td><td class="${s === 'idle' ? 'dim' : 'ok'}">${s}</td><td>${u}</td></tr>`
  )
  .join('')}
</tbody></table></div>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1280, height: 560 },
  deviceScaleFactor: 2
});
await page.setContent(html, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
for (const target of ['public/social.png', 'public/assets/banner.png']) {
  await page.screenshot({
    path: fileURLToPath(new URL(`../${target}`, import.meta.url)),
    type: 'png'
  });
}
await browser.close();
console.log('wrote public/social.png and public/assets/banner.png');
