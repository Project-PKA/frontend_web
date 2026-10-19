import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// The tests run from the root of the repository.
const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), 'utf-8');

/** Files copied as they are from the design system: they only change with the design. */
const VERBATIM = ['tokens.css', 'components.css'];

describe('design system files', () => {
  it.each(VERBATIM)('%s is a verbatim copy of the design system', (file) => {
    expect(read(`app/assets/css/${file}`)).toBe(read(`design/design-system/${file}`));
  });

  it('public/icons.svg is a verbatim copy of the design system sprite', () => {
    expect(read('public/icons.svg')).toBe(read('design/design-system/icons.svg'));
  });
});

function files(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

/** CSS that this project writes: `.css` files, `<style>` blocks and `style` attributes. */
function ownStyles(path: string): string {
  const source = readFileSync(path, 'utf-8');
  if (path.endsWith('.css')) return source;
  if (!path.endsWith('.vue')) return '';
  const blocks = [...source.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]);
  const attributes = [...source.matchAll(/\sstyle="([^"]*)"/g)].map((m) => m[1]);
  return [...blocks, ...attributes].join('\n');
}

const COLOR_LITERAL = /#[0-9a-fA-F]{3,8}\b|\b(?:rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch)\(/;

describe('colors', () => {
  const own = files(resolve(root, 'app'))
    .filter((path) => !VERBATIM.some((file) => path.endsWith(join('css', file))))
    .map((path) => relative(root, path));

  it('are only written in the tokens (no color literal in project styles)', () => {
    const offending = own.filter((path) => COLOR_LITERAL.test(ownStyles(resolve(root, path))));
    expect(offending).toEqual([]);
  });

  it('are checked in at least the project stylesheet', () => {
    expect(own).toContain(join('app', 'assets', 'css', 'app.css'));
  });
});
