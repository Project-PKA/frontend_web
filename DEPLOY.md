# Deploy

> **Decisao deste projeto (bootstrap, etapa 6):** arquivos estaticos do
> `nuxi generate` servidos pela mesma VPS do Backend, atras do proxy reverso,
> que aplica CSP, `Referrer-Policy: no-referrer` e `X-Robots-Tag: noindex` nas
> rotas privadas e por token, e faz o fallback de rota da SPA. **Execucao
> pendente:** VPS e dominio (A7 em `shared/OWNER.md`). Ate la,
> `scripts/deploy.sh` nao esta implementado e nenhum Environment foi criado.

> **CSP: o que a interface precisa** (para o proxy da A7). `img-src` precisa de `'self'`,
> `data:` (icones embutidos pelo build), **`blob:`** (as fotos reais das cartas exigem login e
> sao baixadas como arquivo pelo cliente da API) e o **host de origem das imagens do
> catalogo** (o que o Backend grava em `image_url`; hoje `assets.tcgdex.net`). `connect-src`
> precisa da origem da API. As imagens do catalogo saem com `referrerpolicy="no-referrer"`.

A fundacao separa **como publicar** (depende da plataforma) de **quando e com
que autorizacao publicar** (nao depende).

| Camada | Arquivo | Depende da plataforma? |
| --- | --- | --- |
| Gatilhos, ambientes, aprovacao, build, smoke test | `.github/workflows/deploy.yml` | Nao |
| Politica de aprovacao e secrets | GitHub Environments (interface) | Nao |
| Publicacao propriamente dita | `scripts/deploy.sh` | **Sim** |

Trocar de plataforma e reescrever **um** arquivo: `scripts/deploy.sh`.

---

## Modelo de ambientes

Quatro GitHub Environments, sempre com estes nomes (o workflow os referencia):

| Ambiente | Gatilho | Aprovacao |
| --- | --- | --- |
| `dev` | Automatico a cada push em `main` | Nao |
| `test` | Manual (Actions → Deploy → Run workflow) | Nao |
| `homolog` | Manual | **Sim** (required reviewers) |
| `prod` | Manual ou release publicada | **Sim** (required reviewers) |

A aprovacao e uma protection rule do Environment, nao um `if` no YAML. O
pipeline e identico para os quatro; o que muda sao as secrets, as variables
e quem precisa aprovar. Configuracao passo a passo em
[`SETUP-GITHUB.md`](SETUP-GITHUB.md), secao B4.

**Deploy nao e por branch.** Promover uma versao e rodar o mesmo workflow
sobre o mesmo commit, escolhendo outro ambiente — sem merge cerimonial entre
branches de ambiente.

---

## O contrato de `scripts/deploy.sh`

Entra:

| Variavel | Origem | Sempre presente |
| --- | --- | --- |
| `DEPLOY_ENV` | Workflow | Sim (`dev`/`test`/`homolog`/`prod`) |
| `BUILD_DIR` | `project.mk` | Sim |
| `APP_BASE_URL` | Variable do Environment | Se configurada |
| Demais | Secrets/variables repassadas no `deploy.yml` | Conforme a receita |

Sai: `0` publicou; qualquer outro codigo falha o deploy.

O build **ja foi feito** quando o script roda. Ele so publica.

Ao adotar uma receita, repasse no passo `Publicar` do `deploy.yml` os
secrets e variables que ela usa — o bloco `env:` ja tem exemplos.

---

## Receita: S3 + CloudFront (estatico)

Para SPA ou site estatico. Custo baixo, sem servidor para manter.

**Credenciais:** descomente o bloco `aws-actions/configure-aws-credentials`
no `deploy.yml`. Use **OIDC**, nunca chave de longa duracao.

**Environment secrets/variables:** `AWS_ROLE_ARN` (secret), `AWS_REGION`,
`S3_BUCKET`, `CLOUDFRONT_DISTRIBUTION_ID`, `APP_BASE_URL`.

```sh
# scripts/deploy.sh
set -eu
: "${S3_BUCKET:?defina S3_BUCKET nas variables do Environment}"

# 1. Assets com hash no nome: cache eterno. Sobem ANTES do HTML, para nao
#    existir um index apontando para um asset que ainda nao chegou.
aws s3 sync "$BUILD_DIR/" "s3://$S3_BUCKET/" \
  --exclude '*.html' --exclude '*.json' \
  --cache-control 'public, max-age=31536000, immutable' \
  --no-progress

# 2. HTML e manifests: nunca cacheados — sao eles que apontam para os assets
#    novos. O --delete vai aqui, no fim, para nao remover nada cedo demais.
aws s3 sync "$BUILD_DIR/" "s3://$S3_BUCKET/" \
  --exclude '*' --include '*.html' --include '*.json' \
  --cache-control 'no-cache, must-revalidate' \
  --delete --no-progress

# 3. Invalidacao do CloudFront, so do que nao e imutavel.
if [ -n "${CLOUDFRONT_DISTRIBUTION_ID:-}" ]; then
  id=$(aws cloudfront create-invalidation \
        --distribution-id "$CLOUDFRONT_DISTRIBUTION_ID" \
        --paths '/index.html' '/' \
        --query 'Invalidation.Id' --output text)
  aws cloudfront wait invalidation-completed \
    --distribution-id "$CLOUDFRONT_DISTRIBUTION_ID" --id "$id"
fi
```

**Trust policy do OIDC** — restrinja ao maximo:

```json
{
  "Effect": "Allow",
  "Principal": { "Federated": "arn:aws:iam::<conta>:oidc-provider/token.actions.githubusercontent.com" },
  "Action": "sts:AssumeRoleWithWebIdentity",
  "Condition": {
    "StringEquals": { "token.actions.githubusercontent.com:aud": "sts.amazonaws.com" },
    "StringLike": { "token.actions.githubusercontent.com:sub": "repo:SUA-ORG/SEU-REPO:environment:prod" }
  }
}
```

Com `:environment:prod` no `sub`, a role de producao so pode ser assumida
por um job que **ja passou** pela aprovacao do Environment.

> **Roteamento no cliente:** configure a distribuicao para responder
> **403 e 404** com `/index.html` e status **200**. Sem isso, abrir uma rota
> profunda direto na URL devolve erro em vez da aplicacao.

---

## Receita: Vercel

Para SSR/SSG (Next, Nuxt, SvelteKit, Astro) ou estatico.

**Environment secrets/variables:** `VERCEL_TOKEN` (secret),
`VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`.

```sh
# scripts/deploy.sh
set -eu
: "${VERCEL_TOKEN:?}"

target=preview
[ "$DEPLOY_ENV" = 'prod' ] && target=production

npx vercel pull --yes --environment="$target" --token="$VERCEL_TOKEN"
npx vercel build $([ "$target" = production ] && echo --prod) --token="$VERCEL_TOKEN"
npx vercel deploy --prebuilt $([ "$target" = production ] && echo --prod) \
  --token="$VERCEL_TOKEN"
```

> A Vercel tem integracao automatica com o GitHub. Se voce a usa, desligue-a
> para os ambientes controlados aqui — senao existem dois caminhos de deploy,
> e um deles ignora a aprovacao de homologacao.

---

## Receita: Netlify

```sh
# scripts/deploy.sh
set -eu
: "${NETLIFY_AUTH_TOKEN:?}"
: "${NETLIFY_SITE_ID:?}"

args="--dir=$BUILD_DIR --site=$NETLIFY_SITE_ID --auth=$NETLIFY_AUTH_TOKEN"
[ "$DEPLOY_ENV" = 'prod' ] && args="$args --prod"

npx netlify-cli deploy $args --message "deploy $DEPLOY_ENV ${GITHUB_SHA:-local}"
```

---

## Receita: Cloudflare Pages

```sh
# scripts/deploy.sh
set -eu
: "${CLOUDFLARE_API_TOKEN:?}"
: "${CLOUDFLARE_ACCOUNT_ID:?}"

npx wrangler pages deploy "$BUILD_DIR" \
  --project-name "${CF_PAGES_PROJECT:?}" \
  --branch "$DEPLOY_ENV"
```

---

## Receita: GitHub Pages (estatico)

Para SPA ou site estatico hospedado no proprio GitHub. Tres limitacoes, antes
de escolher:

- **Um site so por repositorio.** Nao existe `dev`/`test`/`homolog` separado:
  so `prod` publica; os outros ambientes viram `skip` registrado (abaixo).
  Para ambientes de teste, use outra plataforma ou preview de PR.
- **Repositorio privado exige plano pago** (GitHub Pro/Team/Enterprise) para
  ter Pages. No Free, so repositorio publico.
- **Caminho base:** sem dominio proprio, o site fica em
  `https://<org>.github.io/<repo>/`. Configure o `base` do bundler (ex.:
  `base: '/<repo>/'` no Vite).

**Configuracao:**

1. **Settings → Pages → Source:** *Deploy from a branch*, branch `gh-pages`, pasta `/`.
2. No `deploy.yml`, job `deploy`: troque `contents: read` por
   `contents: write` (o push para `gh-pages` usa o `GITHUB_TOKEN`) e acrescente
   `GITHUB_TOKEN: ${{ github.token }}` no `env` do passo `Publicar`.
3. `APP_BASE_URL` do Environment `prod` = URL do Pages.

```sh
# scripts/deploy.sh
set -eu
if [ "$DEPLOY_ENV" != 'prod' ]; then
  echo "[skip] GitHub Pages publica um unico site; '$DEPLOY_ENV' nao se aplica (DEPLOY.md)."
  exit 0
fi
: "${GITHUB_TOKEN:?repasse GITHUB_TOKEN no passo Publicar}"

site=$(mktemp -d)
cp -R "$BUILD_DIR"/. "$site"/
touch "$site/.nojekyll"                     # nao processar com Jekyll
# Roteamento no cliente: rota profunda devolve a aplicacao.
[ -f "$site/index.html" ] && cp "$site/index.html" "$site/404.html"

cd "$site"
git init -q
git checkout -q -b gh-pages
git add -A
git -c user.name='github-actions[bot]' \
    -c user.email='41898282+github-actions[bot]@users.noreply.github.com' \
    commit -q -m "chore(pages): publica ${GITHUB_SHA:-local}"
git push -q -f "https://x-access-token:${GITHUB_TOKEN}@github.com/${GITHUB_REPOSITORY}.git" gh-pages
```

A branch `gh-pages` e so artefato (um commit por publicacao, sobrescrito):
nao a proteja com a regra de PR de `main`. Rollback = rodar o Deploy para
`prod` com o SHA anterior.

---

## Receita: container (SSR ou nginx)

Para quando a aplicacao precisa de um servidor, ou quando a organizacao
padroniza container.

**Environment variables:** `REGISTRY`, `IMAGE_NAME`, e o que o orquestrador
exigir.

```sh
# scripts/deploy.sh
set -eu
: "${REGISTRY:?}"
: "${IMAGE_NAME:?}"

tag="${GITHUB_SHA:-local}"
image="$REGISTRY/$IMAGE_NAME:$tag"

docker build -t "$image" -t "$REGISTRY/$IMAGE_NAME:$DEPLOY_ENV" .
docker push "$image"
docker push "$REGISTRY/$IMAGE_NAME:$DEPLOY_ENV"

# Aplicar no orquestrador — ajuste ao seu ambiente:
# kubectl set image deployment/frontend frontend="$image" -n "$DEPLOY_ENV"
# kubectl rollout status deployment/frontend -n "$DEPLOY_ENV" --timeout=5m
```

Dockerfiles de exemplo (estatico via nginx e SSR via Node) estao em
[`docker/`](docker/README.md).

> Container e o unico caminho aqui em que o mesmo artefato pode ser
> promovido entre ambientes — desde que a configuracao seja lida em
> **runtime**, nao embutida no build. Ver `.env.example`, regra 3.

---

## Checklist ao implementar o deploy

- [ ] `scripts/deploy.sh` publica de verdade e falha com codigo != 0 no erro
- [ ] Nenhum segredo no codigo nem em log (use secrets do Environment)
- [ ] Credencial de curta duracao (OIDC) sempre que a plataforma suportar
- [ ] Os quatro Environments existem, com aprovacao em `homolog` e `prod`
- [ ] `APP_BASE_URL` configurada — sem ela o smoke test e pulado em silencio
- [ ] Rota profunda funciona (fallback de SPA), se o roteamento for no cliente
- [ ] Rollback testado ao menos uma vez, antes de precisar dele
- [ ] O caminho de deploy e **unico**: nenhuma integracao automatica da
      plataforma publicando por fora e ignorando a aprovacao

---

## Rollback

<!-- Preencha ao implementar o deploy. Quem estiver de plantao as 3h da manha
     precisa achar isto em 30 segundos. -->

| Ambiente | Como reverter | Quanto tempo leva |
| --- | --- | --- |
| `prod` | <!-- ex.: rodar Deploy com a tag anterior --> | <!-- --> |

**Quando reverter em vez de corrigir:** <!-- criterio do time -->
