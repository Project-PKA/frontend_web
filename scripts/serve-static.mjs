// Serves the static build the way the reverse proxy will: a file, then
// `<path>/index.html`, then the SPA fallback `200.html`. For local preview and e2e only.
// Usage: node scripts/serve-static.mjs <dir> [--port 4173]
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';

const args = process.argv.slice(2);
const root = resolve(args.find((arg) => !arg.startsWith('--')) ?? '.output/public');
const portIndex = args.indexOf('--port');
const port = Number(portIndex >= 0 ? args[portIndex + 1] : (process.env.PORT ?? 4173));

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

async function isFile(path) {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

async function resolveFile(pathname) {
  const target = normalize(join(root, decodeURIComponent(pathname)));
  if (target !== root && !target.startsWith(root + sep)) return null;
  for (const candidate of [target, join(target, 'index.html')]) {
    if (await isFile(candidate)) return candidate;
  }
  return null;
}

createServer(async (request, response) => {
  try {
    const { pathname } = new URL(request.url ?? '/', 'http://localhost');
    const file = await resolveFile(pathname);
    const served = file ?? join(root, '200.html');
    // Unknown paths get the SPA shell with 200, like the proxy fallback.
    response.writeHead(200, {
      'Content-Type': TYPES[extname(served)] ?? 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    createReadStream(served).pipe(response);
  } catch {
    response.writeHead(400).end();
  }
}).listen(port, () => {
  console.log(`Serving ${root} at http://localhost:${port}`);
});
