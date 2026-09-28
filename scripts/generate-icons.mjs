import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const svgPath = path.resolve('public/favicon.svg');
const svgContent = fs.readFileSync(svgPath, 'utf-8');

const CHROME_PATH = process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome-stable';

async function generateIcons() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();

  const renderIcon = async (size, outputPath, isMaskable = false) => {
    // For maskable, safe zone is inner 80% (padding of 10% on each side)
    const padding = isMaskable ? Math.round(size * 0.12) : 0;
    const innerSize = size - padding * 2;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              width: ${size}px;
              height: ${size}px;
              display: flex;
              align-items: center;
              justify-content: center;
              background: #0f1117;
              overflow: hidden;
            }
            svg {
              width: ${innerSize}px;
              height: ${innerSize}px;
            }
          </style>
        </head>
        <body>
          ${svgContent}
        </body>
      </html>
    `;

    await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
    await page.setContent(html);
    const buffer = await page.screenshot({ type: 'png', omitBackground: false });
    fs.writeFileSync(outputPath, buffer);
    console.log(`Generated: ${outputPath} (${size}x${size})`);
  };

  await renderIcon(192, path.resolve('public/icon-192.png'), false);
  await renderIcon(512, path.resolve('public/icon-512.png'), false);
  await renderIcon(192, path.resolve('public/icon-maskable-192.png'), true);
  await renderIcon(512, path.resolve('public/icon-maskable-512.png'), true);
  await renderIcon(180, path.resolve('public/apple-touch-icon.png'), false);

  await browser.close();
  console.log('All icons generated successfully.');
}

generateIcons().catch((err) => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
