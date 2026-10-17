#!/usr/bin/env sh
# =============================================================================
# PONTO DE EXTENSAO DO DEPLOY
#
# O workflow `.github/workflows/deploy.yml` cuida da parte que NAO depende da
# plataforma: gatilhos, escolha do GitHub Environment, aprovacao manual,
# credenciais, build, smoke test e resumo. No fim, ele chama este script.
#
# Este arquivo e o unico lugar que sabe PARA ONDE publicar. Trocar de
# plataforma (S3, Vercel, Netlify, Cloudflare, Azure, container) e reescrever
# este arquivo — nenhum workflow muda.
#
# Receitas prontas para as plataformas mais comuns: DEPLOY.md
#
# -----------------------------------------------------------------------------
# Contrato de entrada
# -----------------------------------------------------------------------------
#   DEPLOY_ENV    dev | test | homolog | prod   (sempre definido pelo workflow)
#   BUILD_DIR     diretorio do artefato ja construido (padrao: dist)
#   APP_BASE_URL  URL publica do ambiente, se configurada
#
#   Tudo o mais (bucket, token, distribuicao, projeto) vem das secrets e
#   variables daquele GitHub Environment — ver SETUP-GITHUB.md.
#
# Saida: 0 = publicado. Qualquer outro codigo falha o deploy.
# =============================================================================
set -eu

DEPLOY_ENV=${DEPLOY_ENV:-}
BUILD_DIR=${BUILD_DIR:-dist}

if [ -z "$DEPLOY_ENV" ]; then
  echo 'deploy: DEPLOY_ENV nao definido.' >&2
  echo 'Rode pelo workflow de deploy, ou: DEPLOY_ENV=dev make deploy' >&2
  exit 2
fi

if [ ! -d "$BUILD_DIR" ]; then
  echo "deploy: diretorio de build nao encontrado: $BUILD_DIR" >&2
  echo 'Rode `make build` antes, ou ajuste BUILD_DIR em project.mk.' >&2
  exit 2
fi

echo "deploy: ambiente=$DEPLOY_ENV origem=$BUILD_DIR"

# -----------------------------------------------------------------------------
# IMPLEMENTE AQUI.
#
# Apague o bloco abaixo e coloque o comando de publicacao da sua plataforma.
# Copie a receita correspondente de DEPLOY.md.
# -----------------------------------------------------------------------------

cat <<'PENDING' >&2

  ============================================================
   DEPLOY NAO IMPLEMENTADO
  ============================================================

  A plataforma de deploy ainda nao foi escolhida para este projeto.

  1. Decida a plataforma  -> BOOTSTRAP.md, etapa 6
  2. Copie a receita      -> DEPLOY.md
  3. Implemente aqui      -> scripts/deploy.sh
  4. Configure os Environments com secrets e variables
                          -> SETUP-GITHUB.md, secao B4

  Ate la, o workflow de deploy falha de proposito: melhor falhar
  explicito do que publicar em lugar nenhum e reportar sucesso.

PENDING

exit 1
