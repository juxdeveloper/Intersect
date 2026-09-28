import fs from 'node:fs';
import path from 'node:path';

const distDir = path.resolve('dist');

function getAllFiles(dir, base = '') {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const relPath = path.join(base, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getAllFiles(filePath, relPath));
    } else {
      results.push('./' + relPath.replace(/\\/g, '/'));
    }
  }
  return results;
}

if (fs.existsSync(distDir)) {
  const allFiles = getAllFiles(distDir);
  // Exclude source maps and hosting control files from the browser cache inventory
  const precacheFiles = allFiles.filter(
    (f) => !f.endsWith('.map') && !['./sw.js', './cache-manifest.json', './_headers', './_redirects', './_routes.json'].includes(f),
  );

  const manifest = {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    assets: precacheFiles,
  };

  fs.writeFileSync(
    path.join(distDir, 'cache-manifest.json'),
    JSON.stringify(manifest, null, 2),
  );
  console.log(`Generated cache-manifest.json with ${precacheFiles.length} assets.`);
} else {
  console.log('dist directory not found, skipping cache-manifest generation.');
}
