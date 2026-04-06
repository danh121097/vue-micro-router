/**
 * Bundle size check — fails if gzipped core exceeds threshold.
 *
 * Run: bun run bench:size
 */
import { execSync } from 'child_process';
import { statSync } from 'fs';
import { gzipSync } from 'zlib';
import { readFileSync } from 'fs';

const THRESHOLD_KB = 9.5; // 8.45kB post-Phase 2 baseline + ~12% headroom

// Build first
console.log('Building...');
execSync('bun run build', { stdio: 'inherit' });

// Check core bundle
const corePath = 'dist/index.mjs';
const coreRaw = readFileSync(corePath);
const coreGzip = gzipSync(coreRaw);
const coreSizeKB = coreGzip.length / 1024;

console.log(`\n=== Bundle Size Check ===`);
console.log(`Core: ${(coreRaw.length / 1024).toFixed(2)} kB raw, ${coreSizeKB.toFixed(2)} kB gzip`);
console.log(`Threshold: ${THRESHOLD_KB} kB gzip`);

// Check audio bundle
try {
  const audioPath = 'dist/audio.mjs';
  const audioRaw = readFileSync(audioPath);
  const audioGzip = gzipSync(audioRaw);
  console.log(`Audio: ${(audioRaw.length / 1024).toFixed(2)} kB raw, ${(audioGzip.length / 1024).toFixed(2)} kB gzip`);
} catch {
  console.log('Audio: not found');
}

// Check styles
try {
  const stylesPath = 'dist/styles.css';
  const stylesRaw = readFileSync(stylesPath);
  const stylesGzip = gzipSync(stylesRaw);
  console.log(`Styles: ${(stylesRaw.length / 1024).toFixed(2)} kB raw, ${(stylesGzip.length / 1024).toFixed(2)} kB gzip`);
} catch {
  console.log('Styles: not found');
}

if (coreSizeKB > THRESHOLD_KB) {
  console.error(`\nFAIL: Core bundle ${coreSizeKB.toFixed(2)} kB exceeds ${THRESHOLD_KB} kB threshold`);
  process.exit(1);
} else {
  console.log(`\nPASS: Core bundle within threshold (${((1 - coreSizeKB / THRESHOLD_KB) * 100).toFixed(0)}% headroom)`);
}
