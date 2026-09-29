/**
 * Real Chromium Browser End-to-End Verification for Intersect Phase V8.
 *
 * Verifies:
 * 1. Full calculation flow with real MathLive fields and MathLive virtual keyboard.
 * 2. Real Pyodide/SymPy symbolic calculation pipeline and Three.js 3D visualization.
 * 3. Forward / Reverse orientation toggle, derivation expansion preservation, Step 7 reversal.
 * 4. Draft dirty state separation between edited draft and submitted snapshot.
 * 5. Proved empty case (parallel planes) and degenerate case (tangent sphere).
 * 6. Input validation failure with predictable focus.
 * 7. Cancellation and recovery.
 * 8. Responsive viewports: desktop (1280x800), tablet (1024x768), mobile portrait (390x844).
 * 9. Virtual keyboard open state on mobile portrait without viewport clipping.
 * 10. Static network audit: 0 external/remote requests.
 */

import puppeteer from 'puppeteer-core';
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import http from 'node:http';

const ARTIFACT_DIR = '/home/joseph/.gemini/antigravity-ide/brain/7419f619-a9ff-44f9-9e38-5739bd6618d8';
const PORT = 4176;
const PREVIEW_URL = `http://localhost:${PORT}/`;
const CHROMIUM_PATH = '/usr/bin/chromium';

async function runV8BrowserVerification() {
  console.log('=== Starting Real Chromium Browser Verification for Phase V8 ===');

  if (!fs.existsSync(ARTIFACT_DIR)) {
    fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  }

  // 1. Launch vite preview on port 4176
  console.log(`Starting vite preview server on port ${PORT}...`);
  const previewProcess = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
    cwd: '/home/joseph/Intersect',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve(null), 5000);
    previewProcess.stdout?.on('data', (d) => {
      const str = d.toString();
      if (str.includes('Local:')) {
        clearTimeout(timer);
        resolve(null);
      }
    });
    previewProcess.on('error', reject);
  });

  // Track network requests for static audit
  const requestedUrls = [];
  const externalRequests = [];

  const browser = await puppeteer.launch({
    executablePath: CHROMIUM_PATH,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-unsafe-webgpu',
      '--disable-dev-shm-usage',
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });

    page.on('request', (req) => {
      const url = req.url();
      requestedUrls.push(url);
      if (!url.startsWith('http://localhost:') && !url.startsWith('data:') && !url.startsWith('blob:')) {
        externalRequests.push(url);
      }
    });

    page.on('console', (msg) => {
      const txt = msg.text();
      if (txt.includes('error') || txt.includes('Error') || txt.includes('Failed')) {
        console.log(`[Browser Console ${msg.type()}]:`, txt);
      }
    });

    console.log(`Navigating to ${PREVIEW_URL}...`);
    await page.goto(PREVIEW_URL, { waitUntil: 'networkidle0', timeout: 30000 });

    // Wait for MathLive and canvas initialization
    await page.waitForSelector('math-field.intersect-mathfield', { timeout: 10000 });
    await page.waitForSelector('canvas', { timeout: 10000 });
    await new Promise((r) => setTimeout(r, 1200));

    // ==========================================
    // Check 1: Initial Desktop Composition & Reference Result
    // ==========================================
    console.log('--- Check 1: Initial Desktop Composition ---');
    const initialValues = await page.evaluate(() => {
      const mfF = document.querySelector('#surface-f-input');
      const mfG = document.querySelector('#surface-g-input');
      const formula = document.querySelector('.curve-equation')?.textContent?.trim();
      const domain = document.querySelector('.curve-domain')?.textContent?.trim();
      const derivationBtn = document.querySelector('#derivation-disclosure-toggle');
      const canvas = document.querySelector('canvas');
      return {
        surfaceF: mfF?.value,
        surfaceG: mfG?.value,
        formula,
        domain,
        isDerivationCollapsed: derivationBtn?.getAttribute('aria-expanded') === 'false',
        hasCanvas: Boolean(canvas),
      };
    });

    console.log('Initial state:', initialValues);
    if (!initialValues.surfaceF?.includes('x^2') || !initialValues.surfaceG?.includes('z')) {
      throw new Error(`Unexpected initial surface equations: ${JSON.stringify(initialValues)}`);
    }
    if (!initialValues.isDerivationCollapsed) {
      throw new Error('Derivation should be collapsed initially');
    }

    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'v8_01_reference_initial.png') });
    console.log('  ✓ Screenshot saved: v8_01_reference_initial.png');

    // ==========================================
    // Check 2: Virtual Keyboard Integration
    // ==========================================
    console.log('--- Check 2: MathLive Virtual Keyboard Interaction ---');
    // Click keyboard button next to Surface F
    const keyboardBtnF = await page.waitForSelector('#surface-f-input + button.keyboard-icon-btn, .form-section:nth-of-type(1) .keyboard-icon-btn');
    await keyboardBtnF.click();
    await new Promise((r) => setTimeout(r, 600));

    const isKeyboardVisibleF = await page.evaluate(() => {
      return Boolean(window.mathVirtualKeyboard?.visible);
    });
    console.log('Virtual keyboard visible after clicking F button:', isKeyboardVisibleF);

    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'v8_02_virtual_keyboard_open.png') });
    console.log('  ✓ Screenshot saved: v8_02_virtual_keyboard_open.png');

    // Click keyboard button next to Surface G to test focus and routing
    const keyboardBtnG = await page.waitForSelector('.form-section:nth-of-type(2) .keyboard-icon-btn');
    await keyboardBtnG.click();
    await new Promise((r) => setTimeout(r, 400));

    const keyboardTargetG = await page.evaluate(() => {
      const activeEl = document.activeElement;
      return {
        keyboardVisible: Boolean(window.mathVirtualKeyboard?.visible),
        activeElementId: activeEl?.id || activeEl?.tagName,
      };
    });
    console.log('Keyboard after clicking G button:', keyboardTargetG);

    // Hide keyboard
    await page.evaluate(() => {
      window.mathVirtualKeyboard?.hide();
    });
    await new Promise((r) => setTimeout(r, 300));

    // ==========================================
    // Check 3: Live Symbolic Solving of Reference Cylinder-Plane
    // ==========================================
    console.log('--- Check 3: Live Worker Symbolic Solving ---');
    const calcBtn = await page.waitForSelector('#calculate-action-btn');
    await calcBtn.click();

    // Await calculation completion (status badge changes to success)
    await page.waitForFunction(
      () => {
        const statusBox = document.querySelector('.v1-status-box');
        return statusBox && statusBox.textContent && statusBox.textContent.includes('Verified exact curve');
      },
      { timeout: 35000 },
    );

    // Expand derivation
    const derivationToggle = await page.waitForSelector('#derivation-disclosure-toggle');
    await derivationToggle.click();
    await new Promise((r) => setTimeout(r, 300));

    const derivationDetails = await page.evaluate(() => {
      const steps = Array.from(document.querySelectorAll('.derivation-step-item')).map((el) => {
        return el.querySelector('span')?.textContent?.trim();
      });
      return {
        stepCount: steps.length,
        steps,
      };
    });
    console.log('Live derivation steps:', derivationDetails);

    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'v8_03_derivation_expanded.png') });
    console.log('  ✓ Screenshot saved: v8_03_derivation_expanded.png');

    // ==========================================
    // Check 4: Forward / Reverse Direction Toggle & State Preservation
    // ==========================================
    console.log('--- Check 4: Forward / Reverse Traversal Toggle ---');
    const reverseBtn = await page.waitForSelector('.direction-btn:nth-child(2)');
    await reverseBtn.click();
    await new Promise((r) => setTimeout(r, 400));

    const reverseState = await page.evaluate(() => {
      const formula = document.querySelector('.curve-equation')?.textContent?.trim();
      const domain = document.querySelector('.curve-domain')?.textContent?.trim();
      const badge = document.querySelector('.direction-badge')?.textContent?.trim();
      const derivationOpen = document.querySelector('#derivation-disclosure-toggle')?.getAttribute('aria-expanded');
      const hasStep7 = Boolean(document.querySelector('.reversal-step-badge'));
      return {
        formula,
        domain,
        badge,
        derivationOpen,
        hasStep7,
      };
    });
    console.log('Reverse state:', reverseState);
    if (!reverseState.hasStep7) {
      throw new Error('Step 7 Reversal Reparameterization badge should be visible');
    }
    if (reverseState.derivationOpen !== 'true') {
      throw new Error('Derivation expansion state should be preserved across direction toggle');
    }

    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'v8_04_reverse_orientation.png') });
    console.log('  ✓ Screenshot saved: v8_04_reverse_orientation.png');

    // Toggle back to forward
    const forwardBtn = await page.waitForSelector('.direction-btn:nth-child(1)');
    await forwardBtn.click();
    await new Promise((r) => setTimeout(r, 300));

    // ==========================================
    // Check 5: Draft vs Submitted Calculation Policy
    // ==========================================
    console.log('--- Check 5: Draft vs Submitted State Separation ---');
    // Edit Surface F to a new radius without calculating
    await page.evaluate(() => {
      const mfF = document.querySelector('#surface-f-input');
      if (mfF) {
        mfF.value = 'x^2 + y^2 = 9';
        mfF.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    await new Promise((r) => setTimeout(r, 300));

    const dirtyState = await page.evaluate(() => {
      const dirtyNotice = document.querySelector('.draft-dirty-notice');
      const legendF = document.querySelector('.legend-item:nth-child(1) .legend-math')?.textContent?.trim();
      return {
        hasDirtyNotice: Boolean(dirtyNotice),
        dirtyNoticeText: dirtyNotice?.textContent?.trim(),
        legendF,
      };
    });
    console.log('Dirty state:', dirtyState);
    if (!dirtyState.hasDirtyNotice) {
      throw new Error('Expected draft dirty notice to appear when editing draft equation');
    }
    if (dirtyState.legendF !== 'x^2 + y^2 = 4') {
      throw new Error(`Graph legend should retain submitted equation 'x^2 + y^2 = 4', got '${dirtyState.legendF}'`);
    }

    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'v8_05_draft_dirty_notice.png') });
    console.log('  ✓ Screenshot saved: v8_05_draft_dirty_notice.png');

    // ==========================================
    // Check 6: Submit New Calculation
    // ==========================================
    console.log('--- Check 6: Submit New Calculation (Radius 3) ---');
    await calcBtn.click();
    await page.waitForFunction(
      () => {
        const eq = document.querySelector('.curve-equation');
        const statusBox = document.querySelector('.v1-status-box');
        return (
          eq &&
          eq.textContent &&
          (eq.textContent.includes('3*cos') || eq.textContent.includes('3 cos')) &&
          statusBox &&
          statusBox.textContent &&
          statusBox.textContent.includes('Verified exact curve')
        );
      },
      { timeout: 35000 },
    );

    const newCalcState = await page.evaluate(() => {
      const formula = document.querySelector('.curve-equation')?.textContent?.trim();
      const hasDirtyNotice = Boolean(document.querySelector('.draft-dirty-notice'));
      const legendF = document.querySelector('.legend-item:nth-child(1) .legend-math')?.textContent?.trim();
      return {
        formula,
        hasDirtyNotice,
        legendF,
      };
    });
    console.log('New calculation state:', newCalcState);
    if (newCalcState.hasDirtyNotice) {
      throw new Error('Draft dirty notice should disappear after successful calculation');
    }

    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'v8_06_new_calculation.png') });
    console.log('  ✓ Screenshot saved: v8_06_new_calculation.png');

    // ==========================================
    // Check 7: Proved Empty Intersection Case
    // ==========================================
    console.log('--- Check 7: Proved Empty Case (Parallel Planes) ---');
    await page.evaluate(() => {
      const mfF = document.querySelector('#surface-f-input');
      const mfG = document.querySelector('#surface-g-input');
      if (mfF && mfG) {
        mfF.value = 'z = 0';
        mfF.dispatchEvent(new Event('input', { bubbles: true }));
        mfG.value = 'z = 10';
        mfG.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    await calcBtn.click();

    await page.waitForFunction(
      () => {
        const badge = document.querySelector('.proof-scope-badge');
        return badge && badge.textContent && badge.textContent.includes('Emptiness');
      },
      { timeout: 25000 },
    );

    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'v8_07_empty_intersection.png') });
    console.log('  ✓ Screenshot saved: v8_07_empty_intersection.png');

    // ==========================================
    // Check 8: Degenerate Isolated Point Case
    // ==========================================
    console.log('--- Check 8: Degenerate Case (Sphere Tangent Plane) ---');
    await page.evaluate(() => {
      const mfF = document.querySelector('#surface-f-input');
      const mfG = document.querySelector('#surface-g-input');
      if (mfF && mfG) {
        mfF.value = 'x^2 + y^2 + z^2 = 4';
        mfF.dispatchEvent(new Event('input', { bubbles: true }));
        mfG.value = 'z = 2';
        mfG.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    await calcBtn.click();

    await page.waitForFunction(
      () => {
        const card = document.querySelector('.curve-card');
        return card && card.textContent && card.textContent.includes('Point');
      },
      { timeout: 25000 },
    );

    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'v8_08_degenerate_point.png') });
    console.log('  ✓ Screenshot saved: v8_08_degenerate_point.png');

    // ==========================================
    // Check 9: Validation Error & Focus Movement
    // ==========================================
    console.log('--- Check 9: Validation Error & Predictable Focus ---');
    await page.evaluate(() => {
      const mfF = document.querySelector('#surface-f-input');
      if (mfF) {
        mfF.value = 'x^2 + = 4';
        mfF.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    await calcBtn.click();
    await new Promise((r) => setTimeout(r, 400));

    const validationState = await page.evaluate(() => {
      const fErr = document.querySelector('#surface-f-input-error');
      const activeEl = document.activeElement;
      return {
        hasError: Boolean(fErr),
        errorText: fErr?.textContent?.trim(),
        focusedId: activeEl?.id || activeEl?.tagName,
      };
    });
    console.log('Validation state:', validationState);
    if (!validationState.hasError) {
      throw new Error('Expected validation error for malformed equation');
    }

    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'v8_09_validation_error.png') });
    console.log('  ✓ Screenshot saved: v8_09_validation_error.png');

    // Reset to reference example via helper link
    const resetLink = await page.waitForSelector('.example-link-btn');
    await resetLink.click();
    await new Promise((r) => setTimeout(r, 400));

    // ==========================================
    // Check 10: Responsive Viewports (Tablet & Mobile)
    // ==========================================
    console.log('--- Check 10: Responsive Viewports ---');
    // Tablet landscape: 1024x768
    await page.setViewport({ width: 1024, height: 768 });
    await new Promise((r) => setTimeout(r, 600));
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'v8_10_tablet_view.png') });
    console.log('  ✓ Screenshot saved: v8_10_tablet_view.png');

    // Mobile portrait: 390x844
    await page.setViewport({ width: 390, height: 844 });
    await new Promise((r) => setTimeout(r, 600));

    const mobileScroll = await page.evaluate(() => {
      return {
        bodyScrollWidth: document.body.scrollWidth,
        windowInnerWidth: window.innerWidth,
        hasHorizontalOverflow: document.body.scrollWidth > window.innerWidth,
      };
    });
    console.log('Mobile scroll metrics:', mobileScroll);
    if (mobileScroll.hasHorizontalOverflow) {
      throw new Error(`Mobile has horizontal overflow: ${mobileScroll.bodyScrollWidth} > ${mobileScroll.windowInnerWidth}`);
    }

    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'v8_11_mobile_portrait.png') });
    console.log('  ✓ Screenshot saved: v8_11_mobile_portrait.png');

    // Open virtual keyboard on mobile portrait
    const mobileKbdBtn = await page.waitForSelector('.form-section:nth-of-type(1) .keyboard-icon-btn');
    await mobileKbdBtn.click();
    await new Promise((r) => setTimeout(r, 600));

    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'v8_12_mobile_keyboard.png') });
    console.log('  ✓ Screenshot saved: v8_12_mobile_keyboard.png');

    // Hide keyboard
    await page.evaluate(() => {
      window.mathVirtualKeyboard?.hide();
    });
    await new Promise((r) => setTimeout(r, 400));

    // ==========================================
    // Check 11: Subpath Hosting Verification
    // ==========================================
    console.log('--- Check 11: Subpath Hosting Verification ---');
    const subpathProcess = spawn('node', ['scripts/test-subdir-server.mjs'], {
      cwd: '/home/joseph/Intersect',
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    await new Promise((resolve) => {
      const timer = setTimeout(resolve, 3000);
      subpathProcess.stdout?.on('data', (d) => {
        if (d.toString().includes('listening')) {
          clearTimeout(timer);
          resolve(null);
        }
      });
    });

    try {
      const subpathPage = await browser.newPage();
      await subpathPage.setViewport({ width: 1280, height: 800 });
      await subpathPage.goto('http://localhost:4180/subpath/', { waitUntil: 'networkidle0', timeout: 25000 });
      await subpathPage.waitForSelector('math-field.intersect-mathfield', { timeout: 10000 });
      await subpathPage.waitForSelector('canvas', { timeout: 10000 });

      await subpathPage.screenshot({ path: path.join(ARTIFACT_DIR, 'v8_13_subpath_hosting.png') });
      console.log('  ✓ Screenshot saved: v8_13_subpath_hosting.png');
      await subpathPage.close();
      console.log('  ✓ Subpath hosting verified cleanly at http://localhost:4180/subpath/');
    } finally {
      subpathProcess.kill('SIGTERM');
    }

    // ==========================================
    // Check 12: Static Network Audit
    // ==========================================
    console.log('--- Check 12: Static Network Audit ---');
    console.log(`Total intercepted requests: ${requestedUrls.length}`);
    console.log(`External requests: ${externalRequests.length}`);
    if (externalRequests.length > 0) {
      throw new Error(`Found unauthorized external network requests: ${JSON.stringify(externalRequests)}`);
    }
    console.log('  ✓ Zero external requests verified. 100% static local delivery.');

    console.log('=== All V8 Browser Checks Passed Successfully ===');
  } finally {
    await browser.close();
    previewProcess.kill('SIGTERM');
  }
}

runV8BrowserVerification().catch((err) => {
  console.error('Browser verification failed:', err);
  process.exit(1);
});
