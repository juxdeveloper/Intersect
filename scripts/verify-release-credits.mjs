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
const origin = process.env.INTERSECT_URL ? new URL(process.env.INTERSECT_URL).origin : `http://localhost:${port}`;
const chrome = process.env.CHROME_PATH || [
  '/usr/bin/google-chrome-stable', '/opt/google/chrome/chrome', '/usr/bin/chromium',
].find((candidate) => fs.existsSync(candidate));
assert(chrome, 'Install Chromium or set CHROME_PATH.');
const preview = process.env.INTERSECT_URL ? null : spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', String(port), '--strictPort'], { stdio: 'pipe' });
let browser;
try {
  if (preview) await new Promise((resolve, reject) => {
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
  await page.emulateMediaFeatures([
    { name: 'prefers-reduced-motion', value: 'reduce' },
    { name: 'prefers-color-scheme', value: 'dark' },
  ]);
  await page.evaluateOnNewDocument(() => {
    window.__renderAudit = { requests: [], results: [], previews: [], frames: 0 };
    const originalFrame = window.requestAnimationFrame;
    window.requestAnimationFrame = (callback) => {
      window.__renderAudit.frames++;
      return originalFrame(callback);
    };
    const OriginalWorker = window.Worker;
    window.Worker = class extends OriginalWorker {
      constructor(...args) {
        super(...args);
        this.addEventListener('message', (event) => {
          if (!['geometry-result', 'geometry-preview'].includes(event.data.type)) return;
          const result = event.data.result;
          let radialError = 0;
          const positions = result.surfaceF.positions;
          for (let i = 0; i < positions.length; i += 3) {
            radialError = Math.max(radialError, Math.abs(Math.hypot(positions[i], positions[i + 1]) - 2));
          }
          const responses = event.data.type === 'geometry-preview' ? window.__renderAudit.previews : window.__renderAudit.results;
          responses.push({ jobId: result.jobId, generation: result.workerGeneration, receivedAt: performance.now(), region: result.renderRegion,
            radialError, cells: result.surfaceF.diagnostics.cellsProcessed,
            triangles: result.surfaceF.triangleCount, duration: result.totalDurationMs,
            fStatus: result.surfaceF.status, gStatus: result.surfaceG.status });
        });
      }
      postMessage(message, ...args) {
        if (message.type === 'generate-geometry') {
          const { jobId, workerGeneration, view, quality, renderRegion, surfaceF, surfaceG } = message.request;
          window.__renderAudit.requests.push({ jobId, generation: workerGeneration, sentAt: performance.now(), view, quality, renderRegion,
            fLabel: surfaceF.label, gLabel: surfaceG.label });
        }
        return super.postMessage(message, ...args);
      }
    };
  });
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
  assert.equal(await page.$eval('#quality-toggle-btn', (el) => el.textContent.trim()), 'Detalle: Auto');
  assert.equal(await page.$eval('html', (el) => el.lang), 'es');
  assert.equal(await page.$('.example-loader-bar'), null, 'Reference reset text must be absent');
  assert.equal(await page.$('.graph-gesture-hint'), null, 'Gesture hint must be absent');
  const spanish = await page.$eval('.app-credits', (el) => el.textContent);
  assert(spanish.includes('Creado y desarrollado por Angel Joseph Estrada Santos (@juxdeveloper)'));
  assert(spanish.includes('Colaborador: Hanniel Cardoso Jaramillo (@HannDev2)'));
  await page.click('#lang-toggle-btn');
  const english = await page.$eval('.app-credits', (el) => el.textContent);
  assert(english.includes('Created & Developed by Angel Joseph Estrada Santos (@juxdeveloper)'));
  assert(english.includes('Collaborator: Hanniel Cardoso Jaramillo (@HannDev2)'));
  assert(english.includes('Free software under GNU GPL 3.0 or later.'));
  const creditLinks = await page.$$eval('.app-credits a', (links) => links.map((link) => ({
    href: link.href, icon: Boolean(link.querySelector('svg')), label: link.getAttribute('aria-label'), rel: link.rel,
  })));
  for (const path of ['https://github.com/juxdeveloper', 'https://github.com/HannDev2', 'https://www.instagram.com/juxdeveloper/']) {
    const link = creditLinks.find((item) => item.href === path);
    assert(link?.icon && link.label && link.rel.includes('noopener'), `Missing accessible profile: ${path}`);
  }
  assert((await page.evaluate(async () => fetch('./LICENSE').then((response) => response.text()))).includes('GNU GENERAL PUBLIC LICENSE'));
  const waitForGeometry = async () => page.waitForFunction(() => {
    const audit = window.__renderAudit;
    return audit.requests.length && audit.results.at(-1)?.jobId === audit.requests.at(-1)?.jobId
      && !document.querySelector('.graph-status-pill.loading');
  }, { timeout: 60000 });
  await waitForGeometry();
  const formula = await page.$eval('.curve-equation math-field', (el) => el.value);
  await page.click('#quality-toggle-btn');
  assert.equal(await page.$eval('#quality-toggle-btn', (el) => el.textContent.trim()), 'Detail: Low');
  await waitForGeometry();
  const low = await page.evaluate(() => window.__renderAudit.results.at(-1));
  assert.equal(low.cells, 112 ** 3, 'Low must retain the previous High grid');
  await page.click('#quality-toggle-btn');
  assert.equal(await page.$eval('#quality-toggle-btn', (el) => el.textContent.trim()), 'Detail: Auto');
  await waitForGeometry();
  const initial = await page.evaluate(() => window.__renderAudit.requests.at(-1).view);
  const canvas = await page.$eval('.three-viewport-canvas', (el) => {
    const rect = el.getBoundingClientRect(); return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  });
  await page.mouse.move(canvas.x, canvas.y);
  for (let i = 0; i < 6; i++) await page.mouse.wheel({ deltaY: -600 });
  await waitForGeometry();
  // The view update is debounced until wheel movement stops.
  await page.waitForFunction((distance) => window.__renderAudit.requests.at(-1).view.distance < distance * 0.25,
    { timeout: 15000 }, initial.distance);
  await waitForGeometry();
  const near = await page.evaluate(() => window.__renderAudit.results.at(-1));
  assert(near.radialError < low.radialError * 0.15, `Cylinder accuracy failed: ${JSON.stringify({ low, near })}`);
  assert.equal(near.fStatus, 'success');
  assert.equal(near.gStatus, 'success');
  const nearPreview = await page.evaluate(() => {
    const audit = window.__renderAudit;
    const last = audit.results.at(-1);
    const preview = audit.previews.find((item) => item.jobId === last.jobId && item.generation === last.generation);
    const request = audit.requests.find((item) => item.jobId === last.jobId && item.generation === last.generation);
    return preview && { ...preview, latencyMs: preview.receivedAt - request.sentAt };
  });
  assert(nearPreview && nearPreview.cells === 64 ** 3, 'Auto must publish a real intermediate mesh before full refinement');
  assert(nearPreview.latencyMs < 1000, `Close Auto preview was not responsive: ${nearPreview.latencyMs}ms`);
  assert.equal(await page.$eval('.curve-equation math-field', (el) => el.value), formula, 'Zoom changed the exact formula');
  const artifacts = process.env.INTERSECT_ARTIFACT_DIR;
  if (artifacts) {
    fs.mkdirSync(artifacts, { recursive: true });
    await page.screenshot({ path: `${artifacts}/close-auto.png` });
  }
  for (let i = 0; i < 30; i++) await page.mouse.wheel({ deltaY: 1000 });
  await page.waitForFunction((distance) => window.__renderAudit.requests.at(-1).view.distance > distance,
    { timeout: 15000 }, initial.distance);
  await waitForGeometry();
  const far = await page.evaluate(() => window.__renderAudit.requests.at(-1).view);
  assert(far.distance <= initial.distance * 1.4 + 0.01, `Excessive zoom-out: ${far.distance}`);
  const count = await page.evaluate(() => window.__renderAudit.frames);
  await new Promise((resolve) => setTimeout(resolve, 800));
  assert.equal(await page.evaluate(() => window.__renderAudit.frames), count, 'Idle render loop stayed active');
  console.log(`PASS: Auto/Low, previous High retained, close cylinder accuracy, bounded zoom, unchanged exact math, idle loop (${JSON.stringify({ initialDistance: initial.distance, maximumDistance: far.distance, lowError: low.radialError, autoError: near.radialError, nearDurationMs: near.duration, nearPreviewLatencyMs: nearPreview.latencyMs })}).`);
  const editLatencies = [];
  for (const value of ['z=\\sin(x)', 'z=\\sin(x)+1', 'z=\\sin(x)+2', 'z=\\sin(x)+3', 'z=\\sin(x)+4', 'z=\\sin(x)']) {
    const editAt = await page.evaluate((value) => {
      const field = document.getElementById('surface-g-input');
      const time = performance.now();
      field.setValue(value, { silenceNotifications: true });
      field.dispatchEvent(new Event('input', { bubbles: true }));
      return time;
    }, value);
    await page.waitForFunction((label, time) => {
      const audit = window.__renderAudit;
      return audit.previews.some((preview) => audit.requests.some((request) => request.sentAt >= time
        && request.gLabel === label && request.jobId === preview.jobId && request.generation === preview.generation));
    }, { timeout: 10000, polling: 20 }, value, editAt);
    const latency = await page.evaluate((label, time) => {
      const audit = window.__renderAudit;
      const preview = audit.previews.find((preview) => audit.requests.some((request) => request.sentAt >= time
        && request.gLabel === label && request.jobId === preview.jobId && request.generation === preview.generation));
      return preview.receivedAt - time;
    }, value, editAt);
    assert(latency < 1000, `Live edit preview exceeded one second: ${latency}ms`);
    editLatencies.push(Math.round(latency));
  }
  await waitForGeometry();
  await page.waitForFunction(() => !document.querySelector('.is-stale-draft'), { timeout: 60000 });
  // Solver completion can start a new geometry job after the last input preview.
  await waitForGeometry();
  assert(!await page.$('.graph-status-pill.loading'), 'Generating indicator remained after current geometry completed');
  console.log(`PASS: six successive live edits, superseding refinement without a backlog; edit-to-preview latencies ${JSON.stringify(editLatencies)}ms.`);
  await page.evaluate(() => {
    const field = document.getElementById('surface-g-input');
    field.setValue('x^2+y^2=4', { silenceNotifications: true });
    field.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.waitForFunction(() => window.__renderAudit.requests.at(-1)?.gLabel === 'x^2+y^2=4', { timeout: 10000 });
  await waitForGeometry();
  const identical = await page.evaluate(() => window.__renderAudit.results.at(-1));
  assert.equal(identical.fStatus, 'success');
  assert.equal(identical.gStatus, 'success');
  console.log('PASS: identical surfaces transfer shared cached geometry without detached-buffer errors.');
  if (artifacts) fs.writeFileSync(`${artifacts}/performance-audit.json`, JSON.stringify(await page.evaluate(() => window.__renderAudit), null, 2));
  for (const width of [1280, 768, 390]) {
    await page.setViewport({ width, height: 844, isMobile: width === 390, hasTouch: width === 390 });
    await waitForGeometry();
    await page.$eval('.app-credits', (el) => el.scrollIntoView());
    const profiles = await page.$eval('.credits-links', (row) => {
      const [github, instagram] = row.querySelectorAll('a');
      const left = github.getBoundingClientRect();
      const right = instagram.getBoundingClientRect();
      return { github: github.href, instagram: instagram.href, left: left.right, right: right.left,
        sameRow: Math.abs(left.top - right.top) < 1 };
    });
    assert(profiles.sameRow && profiles.right > profiles.left, `Instagram must sit to the right of GitHub at ${width}px`);
    assert.equal(profiles.github, 'https://github.com/juxdeveloper');
    assert.equal(profiles.instagram, 'https://www.instagram.com/juxdeveloper/');
    const layout = await page.$eval('.app-credits', (el) => {
      const box = el.getBoundingClientRect();
      return { width: box.width, left: box.left, right: box.right, overflow: el.scrollWidth > el.clientWidth,
        pageOverflow: document.documentElement.scrollWidth > innerWidth, viewport: innerWidth };
    });
    assert(layout.width > 0 && layout.left >= 0 && layout.right <= layout.viewport + 1, JSON.stringify(layout));
    if (layout.overflow || layout.pageOverflow) {
      const overflowing = await page.$$eval('body *', (nodes) => nodes.filter((node) => {
        const rect = node.getBoundingClientRect(); return rect.width && rect.right > innerWidth + 1;
      }).slice(0, 15).map((node) => ({ tag: node.tagName, class: node.className,
        width: node.getBoundingClientRect().width, right: node.getBoundingClientRect().right })));
      if (artifacts) await page.screenshot({ path: `${artifacts}/overflow-${width}.png` });
      assert.fail(`Overflow at ${width}px: ${JSON.stringify({ layout, overflowing })}`);
    }
    if (artifacts) await page.screenshot({ path: `${artifacts}/credits-${width}.png` });
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
  if (artifacts) fs.writeFileSync(`${artifacts}/render-audit.json`, JSON.stringify(await page.evaluate(() => window.__renderAudit), null, 2));
} finally {
  if (browser) await browser.close();
  preview?.kill('SIGTERM');
}
