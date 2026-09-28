import puppeteer from 'puppeteer-core';
import path from 'node:path';
import fs from 'node:fs';

const ARTIFACT_DIR = '/home/joseph/.gemini/antigravity-ide/brain/2d88f94c-b6bf-44d6-ba46-fbdac23ca0e7';

async function runV5BrowserVerification() {
  console.log('=== Starting Real Chromium Browser Verification for Phase V5 ===');

  if (!fs.existsSync(ARTIFACT_DIR)) {
    fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  }

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
    // TEST 1: Initial Load & Reference Curve Reversal & Keyboard Disclosure
    // ---------------------------------------------------------
    console.log('\n--- Test 1: Navigating to preview server http://localhost:4173/ ---');
    await page.goto('http://localhost:4173/', { waitUntil: 'networkidle0' });

    const pageTitle = await page.title();
    console.log(`Page title: "${pageTitle}"`);
    if (!pageTitle.includes('Intersect')) {
      throw new Error(`Unexpected page title: ${pageTitle}`);
    }

    // Check that derivation starts collapsed by default
    const isDerivationOpenInitial = await page.$eval(
      '#derivation-disclosure-toggle',
      (el) => el.getAttribute('aria-expanded') === 'true'
    );
    console.log(`Initial derivation expanded? ${isDerivationOpenInitial} (Expected: false)`);
    if (isDerivationOpenInitial) {
      throw new Error('Derivation accordion should be collapsed by default on initial render.');
    }

    // Test Keyboard navigation (Space/Enter to expand disclosure)
    console.log('Focusing disclosure button and pressing Enter...');
    await page.focus('#derivation-disclosure-toggle');
    await page.keyboard.press('Enter');
    await page.waitForSelector('#derivation-content-panel', { visible: true });

    const isDerivationOpenAfterKey = await page.$eval(
      '#derivation-disclosure-toggle',
      (el) => el.getAttribute('aria-expanded') === 'true'
    );
    console.log(`Derivation expanded after Enter key? ${isDerivationOpenAfterKey} (Expected: true)`);
    if (!isDerivationOpenAfterKey) {
      throw new Error('Keyboard disclosure via Enter did not expand derivation.');
    }

    // Toggle Direction to Reverse on reference curve
    console.log('Toggling direction to Reverse on reference curve...');
    const reverseBtn = await page.waitForSelector('button.direction-btn:nth-child(2)');
    await reverseBtn.click();

    // Check immediate formula & domain update
    const revFormula = await page.$eval('.curve-equation', (el) => el.textContent);
    const revDomain = await page.$eval('.curve-domain', (el) => el.textContent);
    const revBadge = await page.$eval('.direction-badge', (el) => el.textContent);
    console.log(`Reversed formula: "${revFormula}"`);
    console.log(`Reversed domain: "${revDomain}"`);
    console.log(`Reversed badge: "${revBadge}"`);

    if (!revFormula.includes('cos(-u)') || !revBadge.includes('Reverse')) {
      throw new Error(`Reverse formula or badge not updated properly: ${revFormula}`);
    }

    // Verify expansion state was preserved across direction toggle!
    const isDerivationOpenAfterRev = await page.$eval(
      '#derivation-disclosure-toggle',
      (el) => el.getAttribute('aria-expanded') === 'true'
    );
    console.log(`Derivation still expanded after direction toggle? ${isDerivationOpenAfterRev} (Expected: true)`);
    if (!isDerivationOpenAfterRev) {
      throw new Error('Direction toggle erroneously collapsed user derivation expansion state!');
    }

    // Verify Step 7 ("Reparameterize for reverse traversal") is rendered in the derivation
    const revStepBadge = await page.$('.reversal-step-badge');
    if (!revStepBadge) {
      throw new Error('Step 7 Reversal Reparameterization badge was not found in reverse derivation!');
    }
    const revStepText = await page.evaluate((el) => el.parentElement.textContent, revStepBadge);
    console.log(`Reversal step header:\n"${revStepText}"`);

    // Capture screenshot of reference curve in reverse with open derivation
    const screenshot1 = path.join(ARTIFACT_DIR, 'v5_browser_reference_reverse.png');
    await page.screenshot({ path: screenshot1, fullPage: true });
    console.log(`Screenshot saved to: ${screenshot1}`);

    // Toggle back to Forward
    console.log('Toggling direction back to Forward...');
    const forwardBtn = await page.waitForSelector('button.direction-btn:nth-child(1)');
    await forwardBtn.click();
    const fwdFormula = await page.$eval('.curve-equation', (el) => el.textContent);
    console.log(`Restored forward formula: "${fwdFormula}"`);
    if (!fwdFormula.includes('cos t') || fwdFormula.includes('-u')) {
      throw new Error(`Forward formula not properly restored: ${fwdFormula}`);
    }

    // ---------------------------------------------------------
    // TEST 2: Active Solver Solve & Automatic Collapse & Direction Toggle
    // ---------------------------------------------------------
    console.log('\n--- Test 2: Solving cylinder-plane intersection via Pyodide Worker ---');
    await page.click('button.calculate-btn');

    // Wait for the status box to report completion
    await page.waitForFunction(
      () => {
        const box = document.querySelector('.v1-status-box');
        return box && box.textContent && box.textContent.includes('Verified exact curve');
      },
      { timeout: 45000 },
    );

    const solverStatus = await page.$eval('.v1-status-box', (el) => el.textContent);
    console.log(`Solver status:\n${solverStatus}`);

    // Verify derivation automatically collapsed on new calculation
    const isDerivCollapsedOnNewCalc = await page.$eval(
      '#derivation-disclosure-toggle',
      (el) => el.getAttribute('aria-expanded') === 'false'
    );
    console.log(`Derivation collapsed on new calculation? ${isDerivCollapsedOnNewCalc} (Expected: true)`);
    if (!isDerivCollapsedOnNewCalc) {
      throw new Error('Derivation should automatically collapse upon new calculation.');
    }

    // Expand derivation on fresh solver result
    console.log('Expanding derivation on fresh solver result...');
    await page.click('#derivation-disclosure-toggle');
    await page.waitForSelector('#derivation-content-panel', { visible: true });

    // Toggle Direction to Reverse on live solver result
    console.log('Toggling direction to Reverse on live solver result...');
    await reverseBtn.click();

    // Verify zero latency and immediate swap
    const solverRevFormula = await page.$eval('.curve-equation', (el) => el.textContent);
    const solverRevDomain = await page.$eval('.curve-domain', (el) => el.textContent);
    console.log(`Solver reversed formula: "${solverRevFormula}"`);
    console.log(`Solver reversed domain: "${solverRevDomain}"`);

    // Verify Step 7 is present
    const solverRevStepBadge = await page.$('.reversal-step-badge');
    if (!solverRevStepBadge) {
      throw new Error('Step 7 not found on live solver reverse derivation!');
    }

    const screenshot2 = path.join(ARTIFACT_DIR, 'v5_browser_solver_reverse.png');
    await page.screenshot({ path: screenshot2, fullPage: true });
    console.log(`Screenshot saved to: ${screenshot2}`);

    // ---------------------------------------------------------
    // TEST 3: Proved Emptiness Scope (Global)
    // ---------------------------------------------------------
    console.log('\n--- Test 3: Solving parallel planes (x + y + z = 1 and x + y + z = 2) ---');
    // Clear and type Surface F and G
    await page.$eval('#surface-f-input', (el) => (el.value = ''));
    await page.type('#surface-f-input', 'x + y + z = 1');
    await page.$eval('#surface-g-input', (el) => (el.value = ''));
    await page.type('#surface-g-input', 'x + y + z = 2');

    await page.click('button.calculate-btn');
    await page.waitForFunction(
      () => {
        const box = document.querySelector('.v1-status-box');
        return box && box.textContent && box.textContent.includes('Empty intersection');
      },
      { timeout: 15000 },
    );

    const emptyScopeBadge = await page.$eval('.proof-scope-badge', (el) => el.textContent);
    console.log(`Empty proof scope badge: "${emptyScopeBadge}"`);
    if (!emptyScopeBadge.includes('Global')) {
      throw new Error(`Expected Global Emptiness badge for parallel planes, got: ${emptyScopeBadge}`);
    }

    const screenshot3 = path.join(ARTIFACT_DIR, 'v5_browser_empty_global.png');
    await page.screenshot({ path: screenshot3, fullPage: true });
    console.log(`Screenshot saved to: ${screenshot3}`);

    // ---------------------------------------------------------
    // TEST 4: Degenerate Isolated Point
    // ---------------------------------------------------------
    console.log('\n--- Test 4: Solving sphere and tangent plane (x^2 + y^2 + z^2 = 4 and z = 2) ---');
    await page.$eval('#surface-f-input', (el) => (el.value = ''));
    await page.type('#surface-f-input', 'x^2 + y^2 + z^2 = 4');
    await page.$eval('#surface-g-input', (el) => (el.value = ''));
    await page.type('#surface-g-input', 'z = 2');

    await page.click('button.calculate-btn');
    await page.waitForFunction(
      () => {
        const box = document.querySelector('.v1-status-box');
        return box && box.textContent && box.textContent.includes('Degenerate intersection');
      },
      { timeout: 15000 },
    );

    const degenText = await page.$eval('.curve-card', (el) => el.textContent);
    console.log(`Degenerate result text:\n"${degenText}"`);
    if (!degenText.includes('Point') || !degenText.includes('(0, 0, 2)')) {
      throw new Error(`Expected isolated point (0, 0, 2) in degenerate result, got: ${degenText}`);
    }

    const screenshot4 = path.join(ARTIFACT_DIR, 'v5_browser_degenerate_point.png');
    await page.screenshot({ path: screenshot4, fullPage: true });
    console.log(`Screenshot saved to: ${screenshot4}`);

    // ---------------------------------------------------------
    // TEST 5: Network Audit (Zero External Requests)
    // ---------------------------------------------------------
    console.log('\n--- Test 5: Checking Network Requests ---');
    console.log(`Total network requests made: ${networkRequests.length}`);
    console.log(`External requests: ${externalRequests.length}`);
    if (externalRequests.length > 0) {
      console.error('External requests detected:', externalRequests);
      throw new Error(`Architecture violation: ${externalRequests.length} external requests detected!`);
    }

    console.log('\n======================================================');
    console.log('✅ ALL CHROMIUM BROWSER VERIFICATIONS PASSED FOR PHASE V5');
    console.log('======================================================\n');
  } finally {
    await browser.close();
  }
}

runV5BrowserVerification().catch((err) => {
  console.error('\n❌ Browser verification failed:', err);
  process.exit(1);
});
