import { config } from 'zod';

// Zod 4 probes `new Function('')` when a schema is built; under a policy without `unsafe-eval`
// that probe is reported as a violation even though it falls back by itself. The call is at the
// top of the module (not inside the plugin) and the file is named to come first, so it runs
// before any module that builds a schema.
config({ jitless: true });

export default defineNuxtPlugin(() => undefined);
