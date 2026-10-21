import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
// @ts-expect-error The script is plain JavaScript for the build, with no type declarations.
import { NOINDEX_PATHS, buildCsp, buildHashes, inlineScriptHashes } from './csp.mjs';

const hash = (body: string) => `sha256-${createHash('sha256').update(body).digest('base64')}`;

describe('inlineScriptHashes', () => {
  it('hashes the inline scripts that run: plain, module and import map', () => {
    const html = `
      <script>window.__NUXT__={};</script>
      <script type="importmap">{"imports":{}}</script>
      <script type="module">import './x.js'</script>`;
    expect(inlineScriptHashes(html)).toEqual([
      hash('window.__NUXT__={};'),
      hash('{"imports":{}}'),
      hash("import './x.js'"),
    ]);
  });

  it('leaves out data blocks, scripts with a source and empty ones', () => {
    const html = `
      <script type="application/json" id="__NUXT_DATA__">[1,2]</script>
      <script type="application/ld+json">{"@type":"X"}</script>
      <script type="module" src="/_nuxt/a.js" crossorigin></script>
      <script></script>`;
    expect(inlineScriptHashes(html)).toEqual([]);
  });
});

describe('buildHashes', () => {
  it('collects the hashes of every page of the build, sorted and without repeats', () => {
    const dir = mkdtempSync(join(tmpdir(), 'csp-'));
    mkdirSync(join(dir, 'login'));
    writeFileSync(join(dir, 'index.html'), '<script>a()</script><script>b()</script>');
    writeFileSync(join(dir, 'login', 'index.html'), '<script>b()</script>');
    writeFileSync(join(dir, 'app.js'), '<script>not html</script>');
    expect(buildHashes(dir)).toEqual([hash('a()'), hash('b()')].sort());
  });
});

describe('buildCsp', () => {
  const csp = buildCsp({
    hashes: ['sha256-abc='],
    apiOrigin: 'https://api.example.com',
    imageHosts: ['https://assets.example.com'],
  });
  const directive = (name: string) =>
    csp
      .split('; ')
      .find((part) => part.startsWith(`${name} `))
      ?.slice(name.length + 1);

  it('allows scripts only from the own origin and by hash, never inline', () => {
    expect(directive('script-src')).toBe("'self' 'sha256-abc='");
    expect(csp).not.toContain("'unsafe-eval'");
    expect(directive('script-src')).not.toContain('unsafe-inline');
  });

  it('allows the API, the images of the catalog and the photos downloaded as files', () => {
    expect(directive('connect-src')).toBe("'self' https://api.example.com");
    expect(directive('img-src')).toBe("'self' data: blob: https://assets.example.com");
    expect(directive('font-src')).toBe("'self' data:");
  });

  it('shuts plugins, frames and a foreign base tag', () => {
    expect(directive('object-src')).toBe("'none'");
    expect(directive('frame-ancestors')).toBe("'none'");
    expect(directive('base-uri')).toBe("'self'");
  });
});

describe('NOINDEX_PATHS', () => {
  it('keeps the private pages and the ones by token out, and the public ones in', () => {
    expect(NOINDEX_PATHS).toContain('/settlement');
    expect(NOINDEX_PATHS).toContain('/admin');
    expect(NOINDEX_PATHS).not.toContain('/showcase');
    expect(NOINDEX_PATHS).not.toContain('/terms');
  });
});
