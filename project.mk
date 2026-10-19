# =============================================================================
# COMANDOS DO PROJETO
#
# Este e o unico arquivo que voce preenche para ligar a fundacao a sua stack.
# O `Makefile` (que voce nao edita) e o CI so conhecem os nomes abaixo.
#
# Tres estados possiveis para cada variavel:
#
#   vazio   -> nao configurado. O alvo FALHA com instrucao. E o estado inicial.
#   skip    -> nao se aplica a este projeto. O alvo passa, avisando.
#   comando -> executado como esta, no shell.
#
# Use `skip` de forma consciente: ele e uma decisao registrada
# ("este projeto nao tem e2e ainda"), nao um esquecimento. `make doctor`
# mostra os tres estados de uma vez.
#
# O `BOOTSTRAP.md` conduz o preenchimento deste arquivo com um agente de IA.
# Os exemplos comentados no fim servem de ponto de partida.
# =============================================================================

# -----------------------------------------------------------------------------
# Ciclo de desenvolvimento
# -----------------------------------------------------------------------------

# Instala dependencias de forma reprodutivel (lockfile obrigatorio no CI).
SETUP_CMD = npm ci --no-audit --no-fund

# Sobe o servidor de desenvolvimento.
DEV_CMD = npm run dev

# Gera o artefato de producao em $(BUILD_DIR).
BUILD_CMD = npm run generate

# Serve o build localmente. Usado por e2e e por auditoria de performance.
PREVIEW_CMD = npm run preview -- --port $(PREVIEW_PORT) --strictPort

# Remove artefatos e relatorios.
CLEAN_CMD = rm -rf .output .nuxt coverage playwright-report test-results .lighthouseci

# Onde o build deposita o artefato. Ajuste conforme a ferramenta.
# Vite/Astro: dist · Next: .next · CRA/Angular: build|dist · SvelteKit: build
BUILD_DIR = .output/public

# Porta em que PREVIEW_CMD escuta. Usada pelo CI para esperar o servidor.
PREVIEW_PORT = 4173

# -----------------------------------------------------------------------------
# Qualidade
#
# O lint DEVE cobrir, alem dos erros basicos:
#   - acessibilidade  (eslint-plugin-jsx-a11y, vuejs-accessibility, svelte a11y)
#   - code smells     (eslint-plugin-sonarjs ou equivalente)
# Ver ARCHITECTURE.md e o checklist do BOOTSTRAP.md.
# -----------------------------------------------------------------------------

LINT_CMD = npx eslint . --max-warnings=0
LINT_FIX_CMD = npx eslint . --fix
FORMAT_CMD = npx prettier --write .
FORMAT_CHECK_CMD = npx prettier --check .

# `skip` se o projeto nao usa tipagem estatica.
TYPECHECK_CMD = npx nuxt typecheck

# -----------------------------------------------------------------------------
# Testes
# -----------------------------------------------------------------------------

TEST_CMD = npx vitest run
TEST_WATCH_CMD = npx vitest

# Precisa produzir coverage/lcov.info — e o formato que o SonarCloud e o
# comentario de cobertura no PR consomem.
TEST_COVERAGE_CMD = npx vitest run --coverage

# `skip` enquanto nao houver e2e. Registre no TESTING.md quando isso mudar.
E2E_CMD = npx playwright test

# Instalacao de browsers/dependencias do e2e no CI. `skip` se nao precisar.
E2E_INSTALL_CMD = npx playwright install --with-deps chromium

# -----------------------------------------------------------------------------
# Performance
# -----------------------------------------------------------------------------

# Orcamento de bundle. Deve FALHAR quando estourar, nao so avisar.
BUNDLE_BUDGET_CMD = node scripts/bundle-budget.mjs

# Core Web Vitals sobre o build (Lighthouse CI ou equivalente).
PERF_CMD = npx lhci autorun

# -----------------------------------------------------------------------------
# Contrato de API
#
# O contrato (openapi.yaml, schema GraphQL, .proto) e publicado pelo backend e
# NAO deve ser mantido neste repositorio. Aponte para a URL real.
# `skip` se o projeto nao consome API tipada.
# -----------------------------------------------------------------------------

GENERATE_TYPES_CMD = npx openapi-typescript $(OPENAPI_SPEC) -o app/api/generated.ts

# Fonte do contrato. Tambem pode vir do ambiente (ver .env.example).
OPENAPI_SPEC ?= ../Backend/docs/api/openapi.yaml

# =============================================================================
# EXEMPLOS — copie, ajuste e descomente o bloco da sua stack.
# Servem como ponto de partida, nao como recomendacao.
# =============================================================================

# ---- Node + npm + Vite + Vitest + Playwright -------------------------------
# SETUP_CMD          = npm ci --no-audit --no-fund
# DEV_CMD            = npm run dev
# BUILD_CMD          = npm run build
# PREVIEW_CMD        = npm run preview -- --port $(PREVIEW_PORT)
# CLEAN_CMD          = rm -rf $(BUILD_DIR) coverage playwright-report .lighthouseci
# LINT_CMD           = npx eslint . --max-warnings=0
# LINT_FIX_CMD       = npx eslint . --fix
# FORMAT_CMD         = npx prettier --write .
# FORMAT_CHECK_CMD   = npx prettier --check .
# TYPECHECK_CMD      = npx tsc --noEmit
# TEST_CMD           = npx vitest run
# TEST_WATCH_CMD     = npx vitest
# TEST_COVERAGE_CMD  = npx vitest run --coverage
# E2E_CMD            = npx playwright test
# E2E_INSTALL_CMD    = npx playwright install --with-deps chromium
# BUNDLE_BUDGET_CMD  = node scripts/bundle-budget.mjs
# PERF_CMD           = npx lhci autorun
# GENERATE_TYPES_CMD = npx openapi-typescript $(OPENAPI_SPEC) -o src/api/generated.ts

# ---- pnpm ------------------------------------------------------------------
# SETUP_CMD          = pnpm install --frozen-lockfile
# DEV_CMD            = pnpm dev
# BUILD_CMD          = pnpm build

# ---- Bun -------------------------------------------------------------------
# SETUP_CMD          = bun install --frozen-lockfile
# DEV_CMD            = bun run dev
# BUILD_CMD          = bun run build
# TEST_CMD           = bun test

# ---- Deno ------------------------------------------------------------------
# SETUP_CMD          = deno install
# LINT_CMD           = deno lint
# FORMAT_CHECK_CMD   = deno fmt --check
# TYPECHECK_CMD      = deno check .
# TEST_CMD           = deno test -A

# ---- Angular ---------------------------------------------------------------
# BUILD_CMD          = npx ng build --configuration production
# TEST_CMD           = npx ng test --watch=false --browsers=ChromeHeadless
# BUILD_DIR          = dist
