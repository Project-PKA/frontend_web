// Bundle budget: what a visitor downloads, not the sum of every file in the build.
//
//  - entry JS: the scripts the landing page loads (its <script> and modulepreload tags),
//    gzipped and added up. It decides how fast the first page opens.
//  - route chunk: the largest of the other JS files. Each screen is its own chunk, loaded
//    only when it is opened, so the total grows with the app but no one downloads it all.
//  - CSS: all stylesheets, gzipped.
//
// Limits live in bundle-budget.json (in kB). A budget that does not fail is not a budget.
// Usage: node scripts/bundle-budget.mjs [build-dir]   (default: .output/public)
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { pathToFileURL } from 'node:url';

const KB = 1000;

/** The JS files the HTML loads at once: `<script src>` and `<link rel="modulepreload">`. */
export function entryScripts(html) {
  const found = new Set();
  for (const match of html.matchAll(/<script\b[^>]*\bsrc="([^"]+\.js)"/g)) found.add(match[1]);
  for (const match of html.matchAll(/<link\b[^>]*rel="modulepreload"[^>]*href="([^"]+\.js)"/g)) {
    found.add(match[1]);
  }
  return [...found].map((src) => src.replace(/^\//, ''));
}

/** Sizes in bytes -> the three numbers the budget is about. */
export function summarize({ entry, chunks, css }) {
  const sum = (files) => files.reduce((total, file) => total + file.bytes, 0);
  const largest = [...chunks].sort((a, b) => b.bytes - a.bytes)[0] ?? null;
  return { entryBytes: sum(entry), largestChunk: largest, cssBytes: sum(css) };
}

/** Which limits were broken. Limits are in kB. */
export function failures(summary, limits) {
  const broken = [];
  if (summary.entryBytes > limits.entryJsKb * KB) {
    broken.push(`entry JS ${kb(summary.entryBytes)} > ${limits.entryJsKb} kB`);
  }
  if (summary.largestChunk && summary.largestChunk.bytes > limits.routeChunkKb * KB) {
    broken.push(
      `largest route chunk ${summary.largestChunk.file} ${kb(summary.largestChunk.bytes)} > ${limits.routeChunkKb} kB`,
    );
  }
  if (summary.cssBytes > limits.cssKb * KB) {
    broken.push(`CSS ${kb(summary.cssBytes)} > ${limits.cssKb} kB`);
  }
  return broken;
}

const kb = (bytes) => `${(bytes / KB).toFixed(2)} kB`;

function measure(buildDir) {
  const gz = (file) => ({ file, bytes: gzipSync(readFileSync(join(buildDir, file))).length });
  const assets = join(buildDir, '_nuxt');
  const all = readdirSync(assets);
  const entryNames = new Set(entryScripts(readFileSync(join(buildDir, 'index.html'), 'utf-8')));
  const js = all.filter((name) => name.endsWith('.js')).map((name) => `_nuxt/${name}`);
  return {
    entry: js.filter((file) => entryNames.has(file)).map(gz),
    chunks: js.filter((file) => !entryNames.has(file)).map(gz),
    css: all.filter((name) => name.endsWith('.css')).map((name) => gz(`_nuxt/${name}`)),
  };
}

function main() {
  const buildDir = resolve(process.argv[2] ?? '.output/public');
  const limits = JSON.parse(readFileSync(resolve('bundle-budget.json'), 'utf-8'));
  const measured = measure(buildDir);
  const summary = summarize(measured);

  console.log(`Entry JS            ${kb(summary.entryBytes).padStart(10)}  (limit ${limits.entryJsKb} kB)`);
  console.log(
    `Largest route chunk ${kb(summary.largestChunk?.bytes ?? 0).padStart(10)}  (limit ${limits.routeChunkKb} kB) ${summary.largestChunk?.file ?? ''}`,
  );
  console.log(`CSS                 ${kb(summary.cssBytes).padStart(10)}  (limit ${limits.cssKb} kB)`);
  console.log(`Route chunks: ${measured.chunks.length}; all JS together: ${kb(summary.entryBytes + measured.chunks.reduce((t, c) => t + c.bytes, 0))} (not budgeted)`);

  const broken = failures(summary, limits);
  if (broken.length > 0) {
    console.error(`\nBundle budget exceeded:\n - ${broken.join('\n - ')}`);
    process.exit(1);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
