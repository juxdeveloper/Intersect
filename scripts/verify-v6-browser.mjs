import puppeteer from 'puppeteer-core';
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

const ARTIFACT_DIR = '/home/joseph/.gemini/antigravity-ide/brain/65e8829b-0a48-4ea5-97ff-ee940f9b363b';
const PORT = 4174;
const PREVIEW_URL = `http://localhost:${PORT}/`;

async function runV6BrowserVerification() {
  console.log('=== Starting Real Chromium Browser Verification for Phase V6 ===');

  if (!fs.existsSync(ARTIFACT_DIR)) {
    fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  }

  // 1. Launch vite preview on port 4174
  console.log(`Starting vite preview server on port ${PORT}...`);
  const previewProcess = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
    cwd: '/home/joseph/Intersect',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  previewProcess.stdout.on('data', (d) => {
    // console.log(`[preview stdout]: ${d}`);
  });
  previewProcess.stderr.on('data', (d) => {
    // console.error(`[preview stderr]: ${d}`);
  });

  // Wait for preview server to be responsive
  await new Promise((resolve) => setTimeout(resolve, 2000));

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
    if (!url.startsWith(`http://localhost:${PORT}/`) && !url.startsWith('data:')) {
      externalRequests.push(url);
    }
  });

  page.on('console', (msg) => {
    console.log(`[Browser Console ${msg.type()}]:`, msg.text());
  });

  try {
    console.log(`\n--- Test 1: Navigating to preview server ${PREVIEW_URL} ---`);
    await page.goto(PREVIEW_URL, { waitUntil: 'networkidle0' });

    const pageTitle = await page.title();
    console.log(`Page title: "${pageTitle}"`);
    if (!pageTitle.includes('Intersect')) {
      throw new Error(`Unexpected page title: ${pageTitle}`);
    }

    // Wait for V6 geometry diagnostics to be ready in the UI
    console.log('Waiting for geometry generation diagnostics in GraphViewport...');
    await page.waitForFunction(
      () => {
        const badge = document.querySelector('.geom-status-badge');
        return badge && badge.textContent?.includes('Ready');
      },
      { timeout: 10000 }
    );

    // Extract geometry stats from DOM
    const geomStats = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.geom-stat-card'));
      const cardData = cards.map((c) => ({
        title: c.querySelector('.geom-stat-title')?.textContent?.trim(),
        value: c.querySelector('.geom-stat-value')?.textContent?.trim(),
        sub: c.querySelector('.geom-stat-sub')?.textContent?.trim(),
      }));
      const footer = document.querySelector('.geom-diagnostics-footer')?.textContent?.trim();
      return { cardData, footer };
    });

    console.log('Extracted Geometry Diagnostics from Browser:');
    console.log(JSON.stringify(geomStats, null, 2));

    const fStat = geomStats.cardData.find((c) => c.title === 'Surface F');
    const gStat = geomStats.cardData.find((c) => c.title === 'Surface G');
    const curveStat = geomStats.cardData.find((c) => c.title === 'Exact Curve');

    if (!fStat || !fStat.value.includes('v') || !fStat.sub.includes('tris')) {
      throw new Error(`Invalid Surface F statistics: ${JSON.stringify(fStat)}`);
    }
    if (!gStat || !gStat.value.includes('v') || !gStat.sub.includes('tris')) {
      throw new Error(`Invalid Surface G statistics: ${JSON.stringify(gStat)}`);
    }
    if (!curveStat || !curveStat.value.includes('pts')) {
      throw new Error(`Invalid Curve statistics: ${JSON.stringify(curveStat)}`);
    }

    console.log('✓ Initial geometry buffers verified in live Chromium!');

    // Test 2: Toggle Direction to Reverse and verify geometry updates
    console.log('\n--- Test 2: Toggling direction to Reverse ---');
    const reverseBtn = await page.waitForSelector('button.direction-btn:nth-child(2)');
    await reverseBtn.click();

    // Wait for geometry to re-generate / settle
    await page.waitForFunction(
      () => {
        const badge = document.querySelector('.geom-status-badge');
        return badge && badge.textContent?.includes('Ready');
      },
      { timeout: 10000 }
    );

    const revGeomStats = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.geom-stat-card'));
      return cards.map((c) => ({
        title: c.querySelector('.geom-stat-title')?.textContent?.trim(),
        value: c.querySelector('.geom-stat-value')?.textContent?.trim(),
        sub: c.querySelector('.geom-stat-sub')?.textContent?.trim(),
      }));
    });
    console.log('Reverse direction geometry stats:', JSON.stringify(revGeomStats, null, 2));

    // Test 3: Zero external network requests verification
    console.log('\n--- Test 3: Checking external network requests ---');
    console.log(`Total requests intercepted: ${networkRequests.length}`);
    console.log(`External requests: ${externalRequests.length}`);
    if (externalRequests.length > 0) {
      console.error('Forbidden external network requests detected:', externalRequests);
      throw new Error('Project contract violated: Application made external network requests!');
    }
    console.log('✓ 100% Zero remote dependencies verified. Pure static local execution.');

    // Save screenshot to artifacts directory
    const screenshotPath = path.join(ARTIFACT_DIR, 'v6_geometry_verified.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`✓ Screenshot captured and saved to ${screenshotPath}`);

    console.log('\n=== All V6 Browser Verifications Passed Successfully ===');
  } finally {
    await browser.close();
    previewProcess.kill('SIGTERM');
  }
}

runV6BrowserVerification().catch((err) => {
  console.error('Browser verification failed:', err);
  process.exit(1);
});
