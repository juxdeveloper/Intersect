/** Current production smoke check: credits, languages, responsive UI, offline math. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import puppeteer from 'puppeteer-core';

const port = 4197;
const paths = [];
function inventory(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) inventory(path);
    else paths.push(path);
  }
}
inventory('dist');
assert(paths.length <= 20000, 'Cloudflare Pages file count exceeded');
for (const path of paths) assert(fs.statSync(path).size <= 25 * 1024 * 1024, `Pages asset too large: ${path}`);
const manifest = JSON.parse(fs.readFileSync('dist/cache-manifest.json', 'utf8'));
assert(!manifest.assets.some((asset) => /\/(?:_headers|_redirects|_routes\.json)$/.test(asset)), 'Hosting controls must not be cached as runtime assets');
assert(fs.existsSync('dist/_headers'), 'Pages cache headers missing');
console.log(`PASS: Pages limits, ${paths.length} files, complete distribution and hosting control exclusion.`);
const origin = `http://localhost:${port}`;
const chrome = process.env.CHROME_PATH || [
  '/usr/bin/google-chrome-stable', '/opt/google/chrome/chrome', '/usr/bin/chromium',
].find((candidate) => fs.existsSync(candidate));
assert(chrome, 'Install Chromium or set CHROME_PATH.');
const preview = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', String(port), '--strictPort'], { stdio: 'pipe' });
let browser;
try {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Preview startup timed out')), 15000);
    preview.stdout.on('data', (data) => {
      if (data.toString().includes('Local:')) { clearTimeout(timer); resolve(); }
    });
    preview.on('error', (error) => { clearTimeout(timer); reject(error); });
    preview.on('exit', (code) => { clearTimeout(timer); reject(new Error(`Preview exited: ${code}`)); });
  });
  browser = await puppeteer.launch({ executablePath: chrome, headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  browser.on('targetcreated', async (target) => {
    if (target.type() !== 'service_worker') return;
    const session = await target.createCDPSession();
    session.on('Runtime.consoleAPICalled', (event) => {
      if (event.type === 'warning' || event.type === 'error') {
        console.log('Service worker:', event.args.map((arg) => arg.value || arg.description).join(' '));
      }
    });
    await session.send('Runtime.enable');
  });
  const page = await browser.newPage();
  const external = [];
  const errors = [];
  page.on('request', (request) => {
    if (/^https?:/.test(request.url()) && new URL(request.url()).origin !== origin) external.push(request.url());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') console.log('Browser:', message.text()); });
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto(origin, { waitUntil: 'networkidle0' });
  await page.waitForSelector('canvas');
  assert.equal(await page.$eval('html', (el) => el.lang), 'es');
  const spanish = await page.$eval('.app-credits', (el) => el.textContent);
  assert(spanish.includes('Creado y desarrollado por Angel Joseph Estrada Santos (@juxdeveloper)'));
  assert(spanish.includes('Colaborador: Hanniel Cardoso Jaramillo (@HannDev2)'));
  await page.click('#lang-toggle-btn');
  const english = await page.$eval('.app-credits', (el) => el.textContent);
  assert(english.includes('Created & Developed by Angel Joseph Estrada Santos (@juxdeveloper)'));
  assert(english.includes('Collaborator: Hanniel Cardoso Jaramillo (@HannDev2)'));
  for (const width of [1280, 768, 390]) {
    await page.setViewport({ width, height: 844, isMobile: width === 390, hasTouch: width === 390 });
    await page.$eval('.app-credits', (el) => el.scrollIntoView());
    const layout = await page.$eval('.app-credits', (el) => {
      const box = el.getBoundingClientRect();
      return { width: box.width, left: box.left, right: box.right, overflow: el.scrollWidth > el.clientWidth,
        pageOverflow: document.documentElement.scrollWidth > innerWidth, viewport: innerWidth };
    });
    assert(layout.width > 0 && layout.left >= 0 && layout.right <= layout.viewport + 1, JSON.stringify(layout));
    assert(!layout.overflow && !layout.pageOverflow, `Overflow at ${width}px`);
  }
  console.log('PASS: ES/EN credits, desktop/tablet/mobile layout, WebGL canvas.');
  await page.waitForFunction(async () => {
    const manifest = await fetch('./cache-manifest.json').then((response) => response.json());
    for (const asset of manifest.assets) {
      if (!(await caches.match(new URL(asset, location.href).href, { ignoreVary: true }))) return false;
    }
    return Boolean(navigator.serviceWorker.controller);
  }, { timeout: 60000, polling: 1000 }).catch(async (error) => {
    console.log('Cache diagnostic:', await page.evaluate(async () => {
      const manifest = await fetch('./cache-manifest.json').then((res) => res.json());
      const missing = [];
      for (const asset of manifest.assets) if (!(await caches.match(new URL(asset, location.href).href, { ignoreVary: true }))) missing.push(asset);
      return { controller: Boolean(navigator.serviceWorker.controller), registrations: (await navigator.serviceWorker.getRegistrations()).map((reg) => ({ scope: reg.scope, active: reg.active?.state })), caches: await caches.keys(), missing };
    }));
    throw error;
  });
  await page.setOfflineMode(true);
  await page.reload({ waitUntil: 'networkidle0' });
  await page.waitForFunction(() => document.documentElement.lang === 'en' && document.querySelector('.app-credits')?.textContent.includes('Created & Developed by'));
  await page.waitForFunction(() => customElements.get('math-field'));
  await page.evaluate(() => {
    for (const [id, value] of [['surface-f-input', 'x^2+y^2=9'], ['surface-g-input', 'z=x-y']]) {
      const field = document.getElementById(id);
      field.setValue(value, { silenceNotifications: true });
      field.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });
  await page.waitForFunction(() => {
    const formula = document.querySelector('.curve-equation math-field')?.value || '';
    return formula.includes('3') && formula.includes('cos') && formula.includes('sin') && !document.querySelector('.is-stale-draft');
  }, { timeout: 60000 }).catch(async (error) => {
    console.log('Offline calculation diagnostic:', await page.evaluate(() => ({
      text: document.body.innerText,
      formula: document.querySelector('.curve-equation math-field')?.value,
      fields: ['surface-f-input', 'surface-g-input'].map((id) => document.getElementById(id)?.value),
    })));
    throw error;
  });
  console.log('PASS: complete offline cache, reload, persisted language, fresh automatic SymPy calculation.');
  assert.deepEqual(external, [], 'Unexpected external runtime requests');
  assert.deepEqual(errors, [], 'Uncaught browser errors');
  console.log('PASS: zero external runtime requests and uncaught browser errors.');
} finally {
  if (browser) await browser.close();
  preview.kill('SIGTERM');
}
