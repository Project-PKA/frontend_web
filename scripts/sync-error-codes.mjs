// Copies the catalog of API error codes that sits next to the OpenAPI contract
// (docs/api/error-codes.json in the Backend) into app/api/error-codes.json.
// A unit test fails when a code has no translation in both languages.
//
// Usage: node scripts/sync-error-codes.mjs [--check] [path-to-openapi.yaml]
//   --check  changes nothing; exits 1 when the copy in this repository is out of date
import { copyFileSync, existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const args = process.argv.slice(2);
const check = args.includes('--check');
const spec =
  args.find((arg) => !arg.startsWith('--')) ??
  process.env.OPENAPI_SPEC ??
  '../Backend/docs/api/openapi.yaml';
const source = join(dirname(resolve(spec)), 'error-codes.json');
const target = resolve('app/api/error-codes.json');

if (!existsSync(source)) {
  console.error(`Catalog not found: ${source}`);
  process.exit(1);
}

if (check) {
  const same = readFileSync(source, 'utf-8') === readFileSync(target, 'utf-8');
  console.log(same ? 'Error codes are up to date.' : 'Error codes are out of date: run npm run sync:error-codes');
  process.exit(same ? 0 : 1);
}

copyFileSync(source, target);
console.log(`Copied ${source} -> ${target}`);
