import puppeteer from 'puppeteer-core';
import path from 'node:path';
import fs from 'node:fs';

const ARTIFACT_DIR = '/home/joseph/.gemini/antigravity-ide/brain/d57e2d63-4b17-47a9-9796-10bfa2554537';

async function runBrowserVerification() {
  console.log('=== Starting Real Chromium Browser Verification for Phase V4 ===');

  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium',
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  const networkRequests = [];
  const externalRequests = [];

  page.on('request', (req) => {
    const url = req.url();
    networkRequests.push(url);
    if (!url.startsWith('http://localhost:4173/') && !url.startsWith('data:')) {
      externalRequests.push(url);
    }
  });

  page.on('console', (msg) => {
    console.log(`[Browser Console ${msg.type()}]:`, msg.text());
  });

  try {
    // ---------------------------------------------------------
    // TEST 1: Initial Load & Lazy Runtime Check
    // ---------------------------------------------------------
    console.log('\n--- Step 1: Navigating to http://localhost:4173/ ---');
    await page.goto('http://localhost:4173/', { waitUntil: 'networkidle0' });

    const pageTitle = await page.title();
    console.log(`Page title: "${pageTitle}"`);
    if (!pageTitle.includes('Intersect')) {
      throw new Error(`Unexpected page title: ${pageTitle}`);
    }

    // Verify initial state: Pyodide should NOT be loaded before calculation
    const initialRequests = [...networkRequests];
    const initialPyodideLoaded = initialRequests.some((url) => url.includes('pyodide.asm.wasm'));
    console.log(`Initial render Pyodide loaded? ${initialPyodideLoaded} (Expected: false)`);
    if (initialPyodideLoaded) {
      throw new Error('Pyodide WebAssembly runtime was loaded before calculation request!');
    }

    // ---------------------------------------------------------
    // TEST 2: Cold Calculate Execution (Verified Curve)
    // ---------------------------------------------------------
    console.log('\n--- Step 2: Clicking Calculate for x^2 + y^2 = 4 and z = x + y ---');
    const calcStart = Date.now();
    await page.click('button.calculate-btn');

    // Wait for the status box to report completion
    await page.waitForFunction(
      () => {
        const box = document.querySelector('.v1-status-box');
        return box && box.textContent && box.textContent.includes('Verified exact curve parameterization found');
      },
      { timeout: 35000 },
    );

    const coldDuration = Date.now() - calcStart;
    const statusText1 = await page.$eval('.v1-status-box', (el) => el.textContent);
    console.log(`Cold start completed in ${coldDuration}ms.`);
    console.log(`Status output:\n${statusText1}`);

    // Verify curve formula in ResultSection
    const formulaText = await page.$eval('.curve-equation', (el) => el.textContent);
    console.log(`Curve equation: "${formulaText}"`);
    if (!formulaText.includes('r(t)') || !formulaText.includes('cos') || !formulaText.includes('sin')) {
      throw new Error(`Unexpected curve equation: ${formulaText}`);
    }

    const domainText = await page.$eval('.curve-domain', (el) => el.textContent);
    console.log(`Curve domain: "${domainText}"`);
    if (!domainText.includes('0') || (!domainText.includes('2π') && !domainText.includes('2*pi') && !domainText.includes('2pi'))) {
      throw new Error(`Unexpected curve domain: ${domainText}`);
    }

    // Toggle derivation
    console.log('Expanding derivation accordion...');
    await page.click('button.derivation-toggle-btn');
    await page.waitForSelector('.derivation-content', { visible: true });
    const derivationText = await page.$eval('.derivation-content', (el) => el.textContent);
    console.log(`Derivation summary:\n${derivationText.slice(0, 200)}...`);

    // Capture screenshot
    const screenshot1 = path.join(ARTIFACT_DIR, 'browser_v4_verified_curve.png');
    await page.screenshot({ path: screenshot1, fullPage: true });
    console.log(`Screenshot saved to: ${screenshot1}`);

    // ---------------------------------------------------------
    // TEST 3: Warm Runtime Reuse
    // ---------------------------------------------------------
    console.log('\n--- Step 3: Clicking Calculate (Warm Reuse) ---');
    const warmStart = Date.now();
    await page.click('button.calculate-btn');

    await page.waitForFunction(
      () => {
        const box = document.querySelector('.v1-status-box');
        return box && box.textContent && box.textContent.includes('Verified exact curve parameterization found');
      },
      { timeout: 10000 },
    );
    const warmDuration = Date.now() - warmStart;
    console.log(`Warm calculation completed in ${warmDuration}ms.`);

    // ---------------------------------------------------------
    // TEST 4: Empty Intersection (Sphere + High Plane)
    // ---------------------------------------------------------
    console.log('\n--- Step 4: Testing Empty Intersection (x^2 + y^2 + z^2 = 1 and z = 5) ---');
    await page.focus('#surface-f-input');
    await page.keyboard.down('Control');
    await page.keyboard.press('KeyA');
    await page.keyboard.up('Control');
    await page.keyboard.press('Backspace');
    await page.type('#surface-f-input', 'x^2 + y^2 + z^2 = 1');

    await page.focus('#surface-g-input');
    await page.keyboard.down('Control');
    await page.keyboard.press('KeyA');
    await page.keyboard.up('Control');
    await page.keyboard.press('Backspace');
    await page.type('#surface-g-input', 'z = 5');

    await page.click('button.calculate-btn');

    await page.waitForFunction(
      () => {
        const box = document.querySelector('.v1-status-box');
        return box && box.textContent && box.textContent.includes('Empty intersection');
      },
      { timeout: 15000 },
    );

    const emptyStatus = await page.$eval('.v1-status-box', (el) => el.textContent);
    console.log(`Empty test status output:\n${emptyStatus}`);

    const screenshot2 = path.join(ARTIFACT_DIR, 'browser_v4_empty_intersection.png');
    await page.screenshot({ path: screenshot2, fullPage: true });
    console.log(`Screenshot saved to: ${screenshot2}`);

    // ---------------------------------------------------------
    // TEST 5: Degenerate Intersection (Tangent Plane to Sphere)
    // ---------------------------------------------------------
    console.log('\n--- Step 5: Testing Degenerate Intersection (x^2 + y^2 + z^2 = 4 and z = 2) ---');
    await page.focus('#surface-f-input');
    await page.keyboard.down('Control');
    await page.keyboard.press('KeyA');
    await page.keyboard.up('Control');
    await page.keyboard.press('Backspace');
    await page.type('#surface-f-input', 'x^2 + y^2 + z^2 = 4');

    await page.focus('#surface-g-input');
    await page.keyboard.down('Control');
    await page.keyboard.press('KeyA');
    await page.keyboard.up('Control');
    await page.keyboard.press('Backspace');
    await page.type('#surface-g-input', 'z = 2');

    await page.click('button.calculate-btn');

    await page.waitForFunction(
      () => {
        const box = document.querySelector('.v1-status-box');
        return box && box.textContent && box.textContent.includes('Degenerate intersection');
      },
      { timeout: 15000 },
    );

    const degenerateStatus = await page.$eval('.v1-status-box', (el) => el.textContent);
    console.log(`Degenerate test status output:\n${degenerateStatus}`);

    const screenshot3 = path.join(ARTIFACT_DIR, 'browser_v4_degenerate.png');
    await page.screenshot({ path: screenshot3, fullPage: true });
    console.log(`Screenshot saved to: ${screenshot3}`);

    // ---------------------------------------------------------
    // TEST 6: Zero Remote Network Request Audit
    // ---------------------------------------------------------
    console.log('\n--- Step 6: Network Request Audit ---');
    console.log(`Total HTTP requests made: ${networkRequests.length}`);
    console.log(`External / third-party requests: ${externalRequests.length}`);

    const uniqueOrigins = [...new Set(networkRequests.map((u) => new URL(u).origin))];
    console.log('Unique request origins observed:', uniqueOrigins);

    if (externalRequests.length > 0) {
      console.error('VIOLATION: Remote requests detected:', externalRequests);
      throw new Error(`External network requests detected: ${JSON.stringify(externalRequests)}`);
    }

    console.log('✓ AUDIT PASSED: 100% of requests served locally. Zero external CDN or telemetry requests.');
    console.log('\n=== Real Browser Verification SUCCESS ===\n');
  } finally {
    await browser.close();
  }
}

runBrowserVerification().catch((err) => {
  console.error('Browser verification failed:', err);
  process.exit(1);
});
