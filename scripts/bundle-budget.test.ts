import { describe, expect, it } from 'vitest';
import { entryScripts, failures, summarize } from './bundle-budget.mjs';

const KB = 1000;
const file = (name: string, kb: number) => ({ file: name, bytes: kb * KB });
const limits = { entryJsKb: 100, routeChunkKb: 40, cssKb: 20 };

describe('entryScripts', () => {
  const html = `
    <script type="importmap">{"imports":{"#entry":"/_nuxt/entry.js"}}</script>
    <link rel="modulepreload" as="script" crossorigin href="/_nuxt/a.js">
    <link rel="stylesheet" href="/_nuxt/style.css">
    <link rel="prefetch" as="script" href="/_nuxt/later.js">
    <script type="module" src="/_nuxt/entry.js" crossorigin></script>
    <link rel="modulepreload" as="script" href="/_nuxt/a.js">`;

  it('finds the script and the modulepreload files, once each, without the leading slash', () => {
    expect(entryScripts(html).sort()).toEqual(['_nuxt/a.js', '_nuxt/entry.js']);
  });

  it('ignores prefetch, stylesheets and inline scripts', () => {
    expect(entryScripts(html)).not.toContain('_nuxt/later.js');
    expect(entryScripts(html)).not.toContain('_nuxt/style.css');
  });

  it('finds nothing in a page without scripts', () => {
    expect(entryScripts('<html><body>hi</body></html>')).toEqual([]);
  });
});

describe('summarize', () => {
  it('adds up the entry and the CSS and picks the largest route chunk', () => {
    const summary = summarize({
      entry: [file('e1.js', 60), file('e2.js', 30)],
      chunks: [file('c1.js', 10), file('c2.js', 35), file('c3.js', 5)],
      css: [file('a.css', 4), file('b.css', 6)],
    });
    expect(summary.entryBytes).toBe(90 * KB);
    expect(summary.largestChunk).toEqual(file('c2.js', 35));
    expect(summary.cssBytes).toBe(10 * KB);
  });

  it('copes with a build that has no route chunks', () => {
    const summary = summarize({ entry: [file('e.js', 1)], chunks: [], css: [] });
    expect(summary.largestChunk).toBeNull();
  });
});

describe('failures', () => {
  const ok = { entryBytes: 90 * KB, largestChunk: file('c.js', 35), cssBytes: 10 * KB };

  it('passes inside the limits, and at the limit', () => {
    expect(failures(ok, limits)).toEqual([]);
    expect(failures({ ...ok, entryBytes: 100 * KB }, limits)).toEqual([]);
  });

  it('fails when the entry is too big', () => {
    expect(failures({ ...ok, entryBytes: 101 * KB }, limits)).toEqual([
      expect.stringContaining('entry JS'),
    ]);
  });

  it('fails when a route chunk is too big, and names it', () => {
    const broken = failures({ ...ok, largestChunk: file('big.js', 41) }, limits);
    expect(broken).toHaveLength(1);
    expect(broken[0]).toContain('big.js');
  });

  it('fails when the CSS is too big', () => {
    expect(failures({ ...ok, cssBytes: 21 * KB }, limits)).toEqual([expect.stringContaining('CSS')]);
  });

  it('reports every limit that was broken', () => {
    const broken = failures(
      { entryBytes: 200 * KB, largestChunk: file('big.js', 99), cssBytes: 99 * KB },
      limits,
    );
    expect(broken).toHaveLength(3);
  });

  it('does not mind a build without route chunks', () => {
    expect(failures({ ...ok, largestChunk: null }, limits)).toEqual([]);
  });
});
