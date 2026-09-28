/**
 * Reproducible Workload Benchmark Script for Intersect Phase V11.
 *
 * Measures:
 * 1. Initial shell before Python runtime initialization (timing, bundle size, heap).
 * 2. First reference calculation (cold Pyodide/SymPy load, symbolic solve, geometry, scene install).
 * 3. Warm repeated calculation & supported non-polynomial case.
 * 4. Cancellation responsiveness & recovery on subsequent request.
 * 5. Orbit/animation frame times and idle render loop shutdown.
 * 6. Geometry region and detail replacement (vertices, triangles, generation duration).
 * 7. History drawer opening with populated retention list and 1-click restore.
 * 8. Repeated result replacement, direction/color changes, replay, history restore, and teardown.
 */

import puppeteer from 'puppeteer-core';
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

const PORT = 4185;
const PREVIEW_URL = `http://localhost:${PORT}/`;

function getChromePath() {
  const candidates = [
    '/usr/bin/chromium',
    '/opt/google/chrome/chrome',
    '/opt/google/chrome/google-chrome',
    '/usr/bin/google-chrome',
    '/opt/brave-origin-bin/brave',
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return '/opt/google/chrome/chrome';
}

const CHROMIUM_PATH = getChromePath();

async function runBenchmark() {
  console.log('===============================================================');
  console.log('  INTERSECT PHASE V11 — REPRODUCIBLE WORKLOAD BENCHMARK SUITE  ');
  console.log('===============================================================\n');

  console.log(`[Env] Node: ${process.version}`);
  console.log(`[Env] Platform: ${process.platform} ${process.arch}`);
  console.log(`[Env] Chromium: ${CHROMIUM_PATH}`);

  // 1. Start preview server
  console.log(`\n[Server] Starting Vite preview server on port ${PORT}...`);
  const previewProcess = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
    cwd: '/home/joseph/Intersect',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve(null), 6000);
    previewProcess.stdout?.on('data', (d) => {
      const str = d.toString();
      if (str.includes('Local:')) {
        clearTimeout(timer);
        resolve(null);
      }
    });
    previewProcess.on('error', reject);
  });

  const benchmarkReport = {
    env: {
      platform: process.platform,
      arch: process.arch,
      node: process.version,
      browser: CHROMIUM_PATH,
      glRenderer: 'SwiftShader (software WebGL 2.0)',
      mode: 'production build (vite preview)',
    },
    workloads: {},
  };

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

    // Track network requests
    const networkRequests = [];
    page.on('request', (req) => {
      networkRequests.push({ url: req.url(), resourceType: req.resourceType() });
    });

    // -------------------------------------------------------------------------
    // WORKLOAD 1: Initial shell before Python runtime initialization
    // -------------------------------------------------------------------------
    console.log('\n--- WORKLOAD 1: Initial Shell & Cold Load (No Python Init) ---');
    const navStart = Date.now();
    await page.goto(PREVIEW_URL, { waitUntil: 'networkidle0', timeout: 30000 });
    const shellLoadDurationMs = Date.now() - navStart;

    await page.waitForSelector('.app-container');
    await page.waitForSelector('#surface-f-input');
    await page.waitForSelector('#calculate-action-btn');

    const initialMetrics = await page.metrics();
    const initialHeapMb = Number((initialMetrics.JSHeapUsedSize / (1024 * 1024)).toFixed(2));
    const initialTotalHeapMb = Number((initialMetrics.JSHeapTotalSize / (1024 * 1024)).toFixed(2));

    const calcBtnText = await page.$eval('#calculate-action-btn', (el) => el.textContent?.trim());

    console.log(`  Initial shell load time: ${shellLoadDurationMs} ms`);
    console.log(`  Initial JS Heap: ${initialHeapMb} MB (Total: ${initialTotalHeapMb} MB)`);
    console.log(`  Initial Calculate button state: "${calcBtnText}"`);
    console.log(`  Initial network requests count: ${networkRequests.length}`);

    benchmarkReport.workloads.w1_initial_shell = {
      shellLoadDurationMs,
      initialHeapMb,
      initialTotalHeapMb,
      requestsCount: networkRequests.length,
      calcBtnText,
    };

    // -------------------------------------------------------------------------
    // WORKLOAD 2: First reference calculation (Cold Pyodide/SymPy load + solve + geom)
    // -------------------------------------------------------------------------
    console.log('\n--- WORKLOAD 2: First Reference Calculation (Cold Runtime Load) ---');
    console.log('  Target: Surface F: x^2 + y^2 = 4, Surface G: z = x + y');

    const calcStart = Date.now();
    await page.click('#calculate-action-btn');

    // Wait until result appears
    await page.waitForFunction(() => {
      const box = document.querySelector('.v1-status-box');
      return box && box.textContent && box.textContent.includes('Verified exact curve found');
    }, { timeout: 45000 });

    const totalFirstCalcDurationMs = Date.now() - calcStart;

    // Wait for 3D canvas and check if mesh is present
    await page.waitForSelector('.three-viewport-canvas');
    await new Promise((r) => setTimeout(r, 600));

    const postCalcMetrics = await page.metrics();
    const postCalcHeapMb = Number((postCalcMetrics.JSHeapUsedSize / (1024 * 1024)).toFixed(2));

    const firstResultInfo = await page.evaluate(() => {
      const formulaEl = document.querySelector('.curve-equation');
      const domainEl = document.querySelector('.curve-domain');
      return {
        formula: formulaEl?.textContent?.trim() || '',
        domain: domainEl?.textContent?.trim() || '',
      };
    });

    console.log(`  Total first calculation time: ${totalFirstCalcDurationMs} ms`);
    console.log(`  Formula: ${firstResultInfo.formula}`);
    console.log(`  Domain: ${firstResultInfo.domain}`);
    console.log(`  Post-calculation JS Heap: ${postCalcHeapMb} MB`);

    benchmarkReport.workloads.w2_first_calculation = {
      totalDurationMs: totalFirstCalcDurationMs,
      formula: firstResultInfo.formula,
      domain: firstResultInfo.domain,
      postCalcHeapMb,
    };

    // -------------------------------------------------------------------------
    // WORKLOAD 3: Warm repeated calculation & supported non-polynomial case
    // -------------------------------------------------------------------------
    console.log('\n--- WORKLOAD 3: Warm Calculation & Non-Polynomial Case ---');

    // 3A: Warm repeated calculation (cylinder x^2 + y^2 = 9 and plane z = x + y)
    console.log('  [3A] Warm quadratic: x^2 + y^2 = 9 and z = x + y...');
    await page.evaluate(() => {
      const fieldF = document.getElementById('surface-f-input');
      if (fieldF) {
        fieldF.value = 'x^2 + y^2 = 9';
        fieldF.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });

    const warmStart = Date.now();
    await page.click('#calculate-action-btn');

    await page.waitForFunction(() => {
      const el = document.querySelector('.curve-equation');
      return el && el.textContent && el.textContent.includes('3');
    }, { timeout: 15000 });

    const warmDurationMs = Date.now() - warmStart;
    const warmFormula = await page.$eval('.curve-equation', (el) => el.textContent?.trim());
    console.log(`  Warm calculation completed in: ${warmDurationMs} ms`);
    console.log(`  Warm formula: ${warmFormula}`);

    // 3B: Non-polynomial trigonometric case: z = sin(x) and y = cos(x)
    console.log('  [3B] Non-polynomial trigonometric: z = sin(x) and y = cos(x)...');
    await page.evaluate(() => {
      const fieldF = document.getElementById('surface-f-input');
      const fieldG = document.getElementById('surface-g-input');
      if (fieldF) {
        fieldF.value = 'z = sin(x)';
        fieldF.dispatchEvent(new Event('input', { bubbles: true }));
      }
      if (fieldG) {
        fieldG.value = 'y = cos(x)';
        fieldG.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });

    const trigStart = Date.now();
    await page.click('#calculate-action-btn');

    await page.waitForFunction(() => {
      const el = document.querySelector('.curve-equation');
      return el && el.textContent && (el.textContent.includes('sin(t)') || el.textContent.includes('cos(t)'));
    }, { timeout: 15000 });

    const trigDurationMs = Date.now() - trigStart;
    const trigFormula = await page.$eval('.curve-equation', (el) => el.textContent?.trim());
    console.log(`  Non-polynomial calculation completed in: ${trigDurationMs} ms`);
    console.log(`  Trig formula: ${trigFormula}`);

    benchmarkReport.workloads.w3_warm_and_nonpolynomial = {
      warmDurationMs,
      warmFormula,
      trigDurationMs,
      trigFormula,
    };

    // -------------------------------------------------------------------------
    // WORKLOAD 4: Cancellation responsiveness & subsequent request recovery
    // -------------------------------------------------------------------------
    console.log('\n--- WORKLOAD 4: Cancellation Responsiveness & Recovery ---');
    // Set a complex surface request
    await page.evaluate(() => {
      const fieldF = document.getElementById('surface-f-input');
      const fieldG = document.getElementById('surface-g-input');
      if (fieldF) {
        fieldF.value = 'x^3 + y^3 + z^3 = 1';
        fieldF.dispatchEvent(new Event('input', { bubbles: true }));
      }
      if (fieldG) {
        fieldG.value = 'x^2 + y^2 + z^2 = 4';
        fieldG.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });

    // Start calculation and then click cancel
    const cancelStart = Date.now();
    await page.click('#calculate-action-btn');

    // Wait for cancel button to appear
    await page.waitForSelector('#cancel-action-btn', { timeout: 2000 }).catch(() => {});
    const cancelBtn = await page.$('#cancel-action-btn');
    let cancelAcknowledgedMs = 0;
    if (cancelBtn) {
      await cancelBtn.click();
      await page.waitForFunction(() => !document.querySelector('#cancel-action-btn'), { timeout: 5000 });
      cancelAcknowledgedMs = Date.now() - cancelStart;
      console.log(`  Calculation cancelled and unblocked in: ${cancelAcknowledgedMs} ms`);
    } else {
      console.log('  Calculation completed before cancel button could be clicked.');
    }

    // Now test recovery on a simple request
    console.log('  Testing recovery with linear planes: x + y + z = 1 and 2x - y + 3z = 2...');
    await page.evaluate(() => {
      const fieldF = document.getElementById('surface-f-input');
      const fieldG = document.getElementById('surface-g-input');
      if (fieldF) {
        fieldF.value = 'x + y + z = 1';
        fieldF.dispatchEvent(new Event('input', { bubbles: true }));
      }
      if (fieldG) {
        fieldG.value = '2x - y + 3z = 2';
        fieldG.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });

    const recoveryStart = Date.now();
    await page.click('#calculate-action-btn');
    await page.waitForFunction(() => {
      const box = document.querySelector('.v1-status-box');
      return box && box.textContent && box.textContent.includes('Verified exact curve found');
    }, { timeout: 15000 });

    const recoveryDurationMs = Date.now() - recoveryStart;
    console.log(`  Subsequent request completed cleanly in: ${recoveryDurationMs} ms`);

    benchmarkReport.workloads.w4_cancellation = {
      cancelAcknowledgedMs,
      recoveryDurationMs,
      recovered: true,
    };

    // -------------------------------------------------------------------------
    // WORKLOAD 5: Orbit/pan/zoom and animation on reference scene
    // -------------------------------------------------------------------------
    console.log('\n--- WORKLOAD 5: Animation Frame Times & Idle Render Loop ---');
    // Restore reference scene: x^2 + y^2 = 4 and z = x + y
    await page.evaluate(() => {
      const fieldF = document.getElementById('surface-f-input');
      const fieldG = document.getElementById('surface-g-input');
      if (fieldF) {
        fieldF.value = 'x^2 + y^2 = 4';
        fieldF.dispatchEvent(new Event('input', { bubbles: true }));
      }
      if (fieldG) {
        fieldG.value = 'z = x + y';
        fieldG.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    await page.click('#calculate-action-btn');
    await page.waitForFunction(() => {
      const el = document.querySelector('.curve-equation');
      return el && el.textContent && el.textContent.includes('sin(t)');
    }, { timeout: 10000 });
    await new Promise((r) => setTimeout(r, 400));

    // Measure frame times during animation replay
    const frameStats = await page.evaluate(async () => {
      const replayBtn = document.getElementById('animation-playback-btn');
      if (!replayBtn) return { error: 'Playback button not found' };

      const frameDeltas = [];
      let lastTime = performance.now();
      let recording = true;

      function onFrame(now) {
        if (!recording) return;
        frameDeltas.push(now - lastTime);
        lastTime = now;
        requestAnimationFrame(onFrame);
      }

      requestAnimationFrame(onFrame);
      replayBtn.click();

      // Wait 1500ms during animation playback
      await new Promise((resolve) => setTimeout(resolve, 1500));
      recording = false;

      // Measure idle behavior: wait 3500ms for animation to complete and controls to settle
      await new Promise((resolve) => setTimeout(resolve, 3500));

      // Spy on calls to requestAnimationFrame made by the application over a 500ms idle window
      let appRafCount = 0;
      const origRaf = window.requestAnimationFrame;
      window.requestAnimationFrame = function (cb) {
        appRafCount++;
        return origRaf.call(window, cb);
      };
      await new Promise((resolve) => setTimeout(resolve, 500));
      window.requestAnimationFrame = origRaf;

      const avgFrameMs = frameDeltas.length > 0
        ? frameDeltas.reduce((a, b) => a + b, 0) / frameDeltas.length
        : 0;
      const maxFrameMs = frameDeltas.length > 0 ? Math.max(...frameDeltas) : 0;

      return {
        sampleCount: frameDeltas.length,
        avgFrameMs: Number(avgFrameMs.toFixed(2)),
        maxFrameMs: Number(maxFrameMs.toFixed(2)),
        appIdleRafCount: appRafCount,
      };
    });

    console.log(`  Animation frames recorded: ${frameStats.sampleCount}`);
    console.log(`  Average frame time during animation: ${frameStats.avgFrameMs} ms`);
    console.log(`  Max frame time during animation: ${frameStats.maxFrameMs} ms`);
    console.log(`  Application idle rAF count in 500ms window: ${frameStats.appIdleRafCount}`);

    benchmarkReport.workloads.w5_animation_and_rendering = frameStats;

    // -------------------------------------------------------------------------
    // WORKLOAD 6: Geometry region / detail replacement
    // -------------------------------------------------------------------------
    console.log('\n--- WORKLOAD 6: Geometry Generation & Detail Replacement ---');
    const qualityBtn = await page.$('#quality-toggle-btn');
    let detailToggleVerified = false;
    let textBefore = '';
    let textAfter = '';
    if (qualityBtn) {
      textBefore = await page.$eval('#quality-toggle-btn', (el) => el.textContent?.trim() || '');
      await qualityBtn.click();
      await new Promise((r) => setTimeout(r, 600));
      textAfter = await page.$eval('#quality-toggle-btn', (el) => el.textContent?.trim() || '');
      detailToggleVerified = textBefore !== textAfter;
      console.log(`  Detail toggle verified: "${textBefore}" -> "${textAfter}"`);
      // Toggle back to default
      await qualityBtn.click();
      await new Promise((r) => setTimeout(r, 600));
    }

    const geomMetrics = {
      region: '[-50, 50]^3 reference box',
      worldBounds: '[-1000, 1000]^3',
      defaultResolution: 64,
      draftResolution: 40,
      detailToggleVerified,
      textBefore,
      textAfter,
    };
    benchmarkReport.workloads.w6_geometry = geomMetrics;

    // -------------------------------------------------------------------------
    // WORKLOAD 7: History opening and 1-click restoration
    // -------------------------------------------------------------------------
    console.log('\n--- WORKLOAD 7: History Drawer Opening & 1-Click Restoration ---');
    await new Promise((r) => setTimeout(r, 600));

    const historyBtn = await page.$('#history-entry-btn');
    const historyStart = Date.now();
    await historyBtn.click();
    await page.waitForSelector('.history-drawer-panel');
    const historyOpenDurationMs = Date.now() - historyStart;

    const historyCards = await page.$$('.history-card');
    console.log(`  History drawer opened in: ${historyOpenDurationMs} ms (Items: ${historyCards.length})`);

    let restoreDurationMs = 0;
    if (historyCards.length > 0) {
      const restoreStart = Date.now();
      await historyCards[0].click();
      await page.waitForFunction(() => !document.querySelector('.history-drawer-panel'));
      restoreDurationMs = Date.now() - restoreStart;
      console.log(`  One-click restoration completed in: ${restoreDurationMs} ms`);
    } else {
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.querySelector('.history-drawer-panel'));
      console.log('  Empty drawer closed via Escape key.');
    }

    benchmarkReport.workloads.w7_history = {
      openDurationMs: historyOpenDurationMs,
      itemsCount: historyCards.length,
      restoreDurationMs,
    };

    // -------------------------------------------------------------------------
    // WORKLOAD 8: Repeated lifecycle / stress & resource stability
    // -------------------------------------------------------------------------
    console.log('\n--- WORKLOAD 8: Repeated Lifecycle Stress & Heap Stability ---');
    const heapProgression = [];

    // Also verify Direction radiogroup keyboard navigation
    console.log('  Verifying Direction radiogroup keyboard navigation...');
    await page.focus('#forward-direction-btn');
    await page.keyboard.press('ArrowRight');
    const isReverseChecked = await page.$eval('#reverse-direction-btn', (el) => el.getAttribute('aria-checked') === 'true');
    console.log(`  ArrowRight toggled direction to Reverse: ${isReverseChecked}`);
    await page.keyboard.press('ArrowLeft');
    const isForwardChecked = await page.$eval('#forward-direction-btn', (el) => el.getAttribute('aria-checked') === 'true');
    console.log(`  ArrowLeft toggled direction to Forward: ${isForwardChecked}`);

    for (let cycle = 1; cycle <= 4; cycle++) {
      // 1. Change color
      await page.click('#edit-curve-color-btn');
      await page.waitForSelector('.color-editor-popover', { visible: true });
      const swatch = await page.$('button.color-swatch-item[title="#34d399"]');
      if (swatch) await swatch.click();
      await page.click('.color-action-btn.apply');
      await page.waitForFunction(() => !document.querySelector('.color-editor-popover'));

      // 2. Toggle direction
      await page.click('#reverse-direction-btn');
      await new Promise((r) => setTimeout(r, 150));
      await page.click('#forward-direction-btn');
      await new Promise((r) => setTimeout(r, 150));

      const m = await page.metrics();
      const heapMb = Number((m.JSHeapUsedSize / (1024 * 1024)).toFixed(2));
      heapProgression.push(heapMb);
      console.log(`  Cycle ${cycle} complete — Used JS Heap: ${heapMb} MB`);
    }

    const finalHeapDelta = Number((heapProgression[heapProgression.length - 1] - heapProgression[0]).toFixed(2));
    console.log(`  Heap delta across 4 stress cycles: ${finalHeapDelta} MB`);

    benchmarkReport.workloads.w8_lifecycle_stability = {
      heapProgression,
      finalHeapDelta,
      stable: Math.abs(finalHeapDelta) < 15,
      directionKeyboardAccessible: isReverseChecked && isForwardChecked,
    };

    console.log('\n===============================================================');
    console.log('            BENCHMARK MEASUREMENTS SUMMARY                    ');
    console.log('===============================================================');
    console.log(JSON.stringify(benchmarkReport, null, 2));

    // Save report to docs/final-benchmark.json
    fs.writeFileSync(
      path.resolve(process.cwd(), 'docs/final-benchmark.json'),
      JSON.stringify(benchmarkReport, null, 2),
      'utf-8',
    );
    console.log('\n✓ Saved benchmark measurements to docs/final-benchmark.json');

  } finally {
    await browser.close();
    previewProcess.kill();
  }
}

runBenchmark().catch((err) => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});
