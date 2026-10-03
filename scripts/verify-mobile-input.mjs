/** Touch regression gate for overflowing formulas and the local math keyboard. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import puppeteer from 'puppeteer-core';

const origin = process.env.INTERSECT_URL || 'http://localhost:4198';
const artifacts = process.env.INTERSECT_ARTIFACT_DIR || '/tmp/intersect-mobile-input';
fs.mkdirSync(artifacts, { recursive: true });
const preview = process.env.INTERSECT_URL ? null : spawn(process.execPath,
  ['node_modules/vite/bin/vite.js', 'preview', '--port', '4198', '--strictPort']);
let browser;
let page;
const pause = (ms = 100) => new Promise((resolve) => setTimeout(resolve, ms));
try {
  if (preview) await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Preview startup timed out')), 15000);
    preview.stdout.on('data', (chunk) => {
      if (chunk.toString().includes('Local:')) { clearTimeout(timer); resolve(); }
    });
    preview.on('error', reject);
  });
  browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' },
    { name: 'prefers-color-scheme', value: 'dark' }]);
  await page.goto(origin, { waitUntil: 'networkidle0' });
  await page.waitForSelector('.curve-equation math-field', { timeout: 90000 });
  await page.waitForFunction(() => [...document.fonts].some(font => font.family === 'KaTeX_Main' && font.status === 'loaded'));
  await page.evaluate(async () => { await document.fonts.ready; });
  const cdp = await page.createCDPSession();
  const geometry = () => page.evaluate(() => ({
    app: document.querySelector('.app-container').getBoundingClientRect().height,
    viewport: window.visualViewport.height,
    bodyPadding: document.body.style.paddingBottom,
    reserved: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--math-keyboard-height')) || 0,
    visible: window.mathVirtualKeyboard.visible,
    top: document.querySelector('.app-container').getBoundingClientRect().top,
    scrollY: window.scrollY,
  }));
  const baseline = await geometry();
  async function tap(selector) {
    await page.$eval(selector, (element) => element.scrollIntoView({ block: 'center' }));
    await pause();
    const element = await page.$(selector);
    await element.tap();
    await pause();
  }
  async function assertRestored() {
    await page.waitForFunction(() => !window.mathVirtualKeyboard.visible);
    await page.waitForFunction((height) => Math.abs(document.querySelector('.app-container').getBoundingClientRect().height - height) < 1, { timeout: 3000 }, baseline.app);
    const closed = await geometry();
    assert.equal(closed.top, 0, 'Document focus scrolling displaced the application');
    assert.equal(closed.scrollY, 0, 'Document retained a vertical offset');
    assert.equal(closed.reserved, 0, 'Closed keyboard retained a spacer');
    assert.equal(closed.bodyPadding, baseline.bodyPadding, 'Keyboard changed body padding');
    assert(Math.abs(closed.app - baseline.app) < 1, 'App viewport was not fully restored');
    assert.equal(closed.viewport, baseline.viewport, 'A native keyboard changed the viewport');
  }
  for (let cycle = 0; cycle < 10; cycle++) {
    await tap('#surface-f-input');
    await page.waitForFunction(() => window.mathVirtualKeyboard.visible &&
      parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--math-keyboard-height')) > 100);
    await pause();
    const open = await geometry();
    assert(Math.abs(open.app + open.reserved - baseline.app) < 2, 'Keyboard space was counted twice');
    assert.equal(open.bodyPadding, baseline.bodyPadding);
    assert.equal(open.viewport, baseline.viewport);
    assert.equal(await page.$eval('#surface-f-input', (field) => field.getAttribute('inputmode')), 'none');
    assert.equal(await page.$eval('#surface-f-input', (field) =>
      field.shadowRoot.querySelector('[part="keyboard-sink"]').getAttribute('inputmode')), 'none');
    await page.evaluate(() => document.querySelector('#surface-g-input').focus());
    await pause();
    assert((await geometry()).visible, 'Switching editors closed the math keyboard');
    if (cycle % 2) await tap('.curve-equation math-field');
    else await page.evaluate(() => document.querySelector('#surface-g-input').blur());
    await assertRestored();
  }
  console.log('PASS: 10 touch focus/blur cycles, editor transfers, read-only dismissal, zero retained space.');

  await tap('#surface-f-input + .keyboard-icon-btn');
  assert((await geometry()).visible);
  await page.waitForFunction(() => document.querySelector('.MLK__plate')?.getBoundingClientRect().bottom <= innerHeight + 1);
  await pause();
  const key = await page.evaluate(() => [...document.querySelectorAll('.MLK__keycap')]
    .find((element) => element.getAttribute('data-keycap-value') === '7' && element.getBoundingClientRect().height > 0)?.getBoundingClientRect().toJSON());
  assert(key, 'Numeric keyboard key missing');
  await page.screenshot({ path: `${artifacts}/keyboard-open.png` });
  const before = await page.$eval('#surface-f-input', (field) => field.value);
  await page.touchscreen.tap(key.x + key.width / 2, key.y + key.height / 2);
  await pause();
  assert.notEqual(await page.$eval('#surface-f-input', (field) => field.value), before, 'Math keyboard did not insert');
  assert((await geometry()).visible, 'Typing dismissed the keyboard');
  await tap('#surface-f-input + .keyboard-icon-btn');
  await assertRestored();
  console.log('PASS: toggle opens/closes reliably and built-in keys insert into the editor.');

  await page.setViewport({ width: 320, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
  // Start a fresh page so the insertion check cannot leave a pending solver job.
  await page.reload({ waitUntil: 'networkidle0' });
  await page.waitForSelector('.curve-equation math-field', { timeout: 90000 });
  await page.waitForFunction(() => [...document.fonts].some(font => font.family === 'KaTeX_Main' && font.status === 'loaded'));
  await page.evaluate(async () => { await document.fonts.ready; });
  // Exercise the real read-only renderer with the long reverse curve from the report.
  // Solver behavior is covered separately by the production/offline release gate.
  await page.evaluate(() => {
    document.querySelector('.curve-equation math-field').setValue(
      '\\mathbf{r}(t)=\\left(2\\cos t,-2\\sin t,2\\cos t-\\sin(2\\sin t)\\right)',
      { silenceNotifications: true });
    document.querySelector('#surface-g-input').setValue(
      'z=x+\\sin y+\\cos x+\\sqrt{x^2+y^2}+\\frac{x+y}{1+x^2+y^2}',
      { silenceNotifications: true });
  });
  async function swipeFormula(selector) {
    await page.$eval(selector, (field) => {
      field.scrollIntoView({ block: 'center' });
      (field.closest('.curve-equation') || field.shadowRoot.querySelector('[part="content"]')).scrollLeft = 0;
    });
    await pause();
    const dimensions = await page.$eval(selector, (field) => {
      const content = (field.closest('.curve-equation') || field.shadowRoot.querySelector('[part="content"]'));
      const rect = content.getBoundingClientRect();
      return { width: content.clientWidth, fullWidth: content.scrollWidth,
        x: rect.left, y: rect.top + rect.height / 2 };
    });
    console.log('Formula overflow:', selector, dimensions, await page.$eval(selector, f=>f.value));
    assert(dimensions.fullWidth > dimensions.width + 2, 'Long formula did not expose overflow');
    const start = dimensions.x + dimensions.width - 15;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: start, y: dimensions.y }] });
    for (let step = 1; step <= 8; step++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: start - step * 24, y: dimensions.y }] });
      await pause(30);
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await pause();
    const offset = await page.$eval(selector, (field) => (field.closest('.curve-equation') || field.shadowRoot.querySelector('[part="content"]')).scrollLeft);
    assert(offset > 2, `Touch swipe did not scroll ${selector}: ${offset}`);
    const end = await page.$eval(selector, (field) => {
      const content = (field.closest('.curve-equation') || field.shadowRoot.querySelector('[part="content"]'));
      content.scrollLeft = content.scrollWidth;
      return { offset: content.scrollLeft, max: content.scrollWidth - content.clientWidth,
        right: content.getBoundingClientRect().right };
    });
    assert(Math.abs(end.offset - end.max) < 2, 'Formula end is unreachable');
    assert(end.right <= await page.evaluate(() => innerWidth), 'Equation widened the page');
  }
  await swipeFormula('.curve-equation math-field');
  assert(!(await geometry()).visible, 'Read-only swipe opened a keyboard');
  await swipeFormula('#surface-g-input');
  await page.evaluate(() => document.querySelector('#surface-g-input').blur());
  await assertRestored();
  await page.$eval('.curve-card', (element) => element.scrollIntoView({ block: 'center' }));
  await page.screenshot({ path: `${artifacts}/mobile-formula-scroll.png` });
  console.log('PASS: real touch swipes scroll long exact results and long input formulas.');
  await page.setViewport({ width: 844, height: 390, isMobile: true, hasTouch: true });
  await tap('#surface-f-input');
  await page.waitForFunction(() => window.mathVirtualKeyboard.visible);
  await page.waitForFunction(() => {
    const field = document.querySelector('#surface-f-input').getBoundingClientRect();
    const plate = document.querySelector('.MLK__plate')?.getBoundingClientRect();
    return field.top >= 0 && plate && field.bottom <= plate.top;
  }, { timeout: 3000 });
  await pause(250);
  assert(await page.evaluate(() => {
    const field = document.querySelector('#surface-f-input').getBoundingClientRect();
    const plate = document.querySelector('.MLK__plate')?.getBoundingClientRect();
    return field.top >= 0 && plate && field.bottom <= plate.top;
  }), 'Landscape focus did not remain visible after layout settled');
  assert.equal((await geometry()).top, 0, 'Landscape keyboard displaced the page');
  await page.screenshot({ path: `${artifacts}/landscape-keyboard.png` });
  await page.evaluate(() => document.querySelector('#surface-f-input').blur());
  await page.waitForFunction(() => !window.mathVirtualKeyboard.visible);
  assert.equal((await geometry()).reserved, 0);
  await page.setViewport({ width: 1280, height: 800, isMobile: false, hasTouch: false });
  await page.reload({ waitUntil: 'networkidle0' });
  await page.focus('#surface-g-input');
  await page.keyboard.type('+1');
  assert(!(await geometry()).visible, 'Physical desktop typing opened the mobile keyboard');
  assert((await page.$eval('#surface-g-input', (field) => field.value)).includes('1'));
  assert.deepEqual(errors, []);
  console.log('PASS: landscape dismissal, desktop physical typing, and no browser errors.');
} catch (error) {
  if (page && !page.isClosed()) {
    console.error('Failure layout:', await page.evaluate(() => ({
      active: document.activeElement?.id, scrollY: window.scrollY,
      keyboard: window.mathVirtualKeyboard?.boundingRect.toJSON(),
      panels: ['.app-container', '.sidebar', '#surface-f-input'].map(selector => {
        const element = document.querySelector(selector);
        return { selector, rect: element?.getBoundingClientRect().toJSON(),
          scrollTop: element?.scrollTop, scrollHeight: element?.scrollHeight,
          clientHeight: element?.clientHeight, overflowY: element && getComputedStyle(element).overflowY };
      }),
    })));
    await page.screenshot({ path: `${artifacts}/mobile-failure.png` });
  }
  throw error;
} finally {
  await browser?.close();
  preview?.kill();
}
