// The Content-Security-Policy of the static build, for the reverse proxy.
//
// `nuxi generate` puts a few inline scripts in every page (the config of the app and the import
// map). The policy does not allow `'unsafe-inline'` for scripts, so each one is allowed by its
// hash. The hashes change with every build (the build id is in one of them), which is why the
// header is generated from the build and not written by hand.
//
// Usage: node scripts/csp.mjs [dir] --api https://api.example.com [--images https://host ...]
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** The inline scripts that run: no `type`, a module or an import map. Data blocks (JSON) do not. */
const EXECUTABLE = new Set(['', 'module', 'importmap']);
const INLINE_SCRIPT = /<script((?:\s[^>]*)?)>([\s\S]*?)<\/script>/gi;

/** `sha256-...` of every inline script of a page that the browser would run. */
export function inlineScriptHashes(html) {
  const hashes = [];
  for (const [, attributes, body] of html.matchAll(INLINE_SCRIPT)) {
    if (/\ssrc\s*=/i.test(attributes) || body === '') continue;
    const type = /\stype\s*=\s*["']?([^"'\s>]*)/i.exec(attributes)?.[1] ?? '';
    if (!EXECUTABLE.has(type)) continue;
    hashes.push(`sha256-${createHash('sha256').update(body, 'utf8').digest('base64')}`);
  }
  return hashes;
}

/** Every `.html` file under a directory. */
function htmlFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) files.push(...htmlFiles(path));
    else if (entry.endsWith('.html')) files.push(path);
  }
  return files;
}

/** The hashes of the whole build, sorted and without repeats. */
export function buildHashes(dir) {
  const all = new Set();
  for (const file of htmlFiles(dir)) {
    for (const hash of inlineScriptHashes(readFileSync(file, 'utf8'))) all.add(hash);
  }
  return [...all].sort();
}

/**
 * The policy: everything from the own origin, the API in `connect-src`, the images of the catalog
 * (and the photos downloaded as files: `blob:`), no plugins, no frames, no base tag. Styles allow
 * inline because the interface sets widths and heights in `style=""` (bars, progress).
 */
export function buildCsp({ hashes, apiOrigin, imageHosts = [] }) {
  const sources = (list) => list.filter(Boolean).join(' ');
  const quoted = hashes.map((hash) => "'" + hash + "'");
  return [
    "default-src 'self'",
    `script-src ${sources(["'self'", ...quoted])}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src ${sources(["'self'", 'data:', 'blob:', ...imageHosts])}`,
    "font-src 'self' data:",
    `connect-src ${sources(["'self'", apiOrigin])}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}

/** The headers of every response of the static site. */
export const COMMON_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

/**
 * The pages that must not be indexed: the app of the stores, the area of the administrator and the
 * pages opened with a token. The landing, the showcase and the legal pages are public on purpose.
 */
export const NOINDEX_PATHS = [
  '/login',
  '/invite',
  '/convite',
  '/request-access',
  '/settlement',
  '/consignor',
  '/stores',
  '/home',
  '/inventory',
  '/auctions',
  '/customers',
  '/settlements',
  '/finance',
  '/team',
  '/settings',
  '/plan',
  '/whatsapp',
  '/activity',
  '/profile',
  '/admin',
];

function option(args, name) {
  const values = [];
  args.forEach((arg, index) => {
    if (arg === name && args[index + 1]) values.push(args[index + 1]);
  });
  return values;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const dir = resolve(args.find((arg, index) => !arg.startsWith('--') && !args[index - 1]?.startsWith('--')) ?? '.output/public');
  const [apiOrigin] = option(args, '--api');
  console.log(buildCsp({ hashes: buildHashes(dir), apiOrigin, imageHosts: option(args, '--images') }));
}
