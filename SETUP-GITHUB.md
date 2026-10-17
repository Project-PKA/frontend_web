# Checklist de configuracao manual

Tudo aqui **so pode ser feito pela interface do GitHub** (ou pela API/CLI) —
nenhum arquivo do repositorio consegue configurar essas coisas sozinho.

- **Parte A** — no repositorio TEMPLATE, uma unica vez.
- **Parte B** — em cada projeto criado a partir dele.

Em um projeto real, **apague este arquivo** depois de concluir a Parte B.

---

# Parte A — no repositorio template (uma vez)

## A1. Marcar como Template Repository

- [ ] **Settings → General → Template repository** → marcar

Sem isso o botao **"Use this template"** nao aparece, e as pessoas vao
acabar dando fork — o que herda issues, PRs e o vinculo com o upstream.

A marcacao tambem muda o CI: no repositorio template, os jobs que dependem
de stack (qualidade, testes, build, CodeQL, release, deploy) sao pulados.
Convencoes e o agente continuam rodando.

## A1.1 Pre-requisito: IgorOCosta/workflows publico e com a tag `v1`

Os workflows deste repositorio chamam os workflows centrais em
`IgorOCosta/workflows/.github/workflows/*.yml@v1`.

- [ ] `IgorOCosta/workflows` e **publico** (workflow reutilizavel de repo
      privado nao e visivel para outras organizacoes)
- [ ] A tag `v1` existe no IgorOCosta/workflows (`git tag v1 && git push origin v1`
      na primeira vez; depois a release do repositório de workflows move a tag sozinha)

## A2. Configuracao geral

- [ ] **Settings → General → Pull Requests**
  - [ ] **Allow squash merging** — marcado
  - [ ] Default commit message: **Pull request title and description**
  - [ ] **Allow merge commits** — desmarcado
  - [ ] **Allow rebase merging** — desmarcado
  - [ ] **Automatically delete head branches** — marcado
- [ ] **Settings → General → Features**
  - [ ] Issues — ligado
  - [ ] Discussions — ligado se voce usa o link em
        `ISSUE_TEMPLATE/config.yml` (senao, remova o link de la)

## A3. Permissoes do Actions

- [ ] **Settings → Actions → General → Workflow permissions**
  - [ ] **Read repository contents and packages permissions** (somente
        leitura). Os workflows pedem escrita por job, explicitamente;
        deixar o padrao em leitura limita o estrago de um workflow
        comprometido.
  - [ ] **Allow GitHub Actions to create and approve pull requests** —
        desmarcado. Release e sincronizacao de contrato usam o
        `AUTOMATION_TOKEN` (B7), nao o `GITHUB_TOKEN`.
- [ ] **Settings → Actions → General → Actions permissions**
  - [ ] Permitir actions da propria organizacao + as usadas aqui:
        `IgorOCosta/workflows/*` (workflows centrais), `actions/*`,
        `github/codeql-action/*`, `jdx/mise-action`, `SonarSource/*`,
        `googleapis/release-please-action`, `peter-evans/create-pull-request`,
        e as da plataforma de deploy escolhida
        (`aws-actions/*`, `google-github-actions/*`, `azure/*`)

## A4. Seguranca

- [ ] **Settings → Code security**
  - [ ] Dependency graph — ligado
  - [ ] Dependabot alerts — ligado
  - [ ] Dependabot security updates — ligado
  - [ ] Secret scanning — ligado
  - [ ] Push protection — ligado (bloqueia commit com segredo antes de subir)
  - [ ] CodeQL — **Advanced** (o workflow `codeql.yml` ja esta no repo;
        nao use Default, que conflita)

## A5. Validar antes de divulgar

- [ ] Criar um repositorio de teste via **Use this template**
- [ ] Rodar a Parte B inteira nele, com uma stack simples
- [ ] Abrir um PR de teste e conferir:
  - [ ] o CI roda e `ci-success` aparece
  - [ ] o agente comenta convencoes e cobertura
  - [ ] a issue vinculada fecha no merge
- [ ] Rodar um deploy para `dev`
- [ ] Apagar o repositorio de teste

---

# Parte B — em cada projeto criado do template

## B1. Bootstrap

- [ ] Criado por **Use this template → Create a new repository** (nao fork)
- [ ] `make doctor` rodado para ver o estado inicial
- [ ] [`BOOTSTRAP.md`](BOOTSTRAP.md) concluido — as dez etapas
- [ ] `project.mk` preenchido; `make doctor` sem obrigatorio pendente
- [ ] `.tool-versions` com a versao do runtime
- [ ] Lockfile da stack commitado
- [ ] **`AGENTS.md` reescrito** com o contexto real

## B2. Substituir placeholders

Busque por `SUA-ORG` e `SEU-REPOSITORIO` e troque em:

- [ ] `.github/CODEOWNERS` — times reais (precisam ter acesso ao repo)
- [ ] `.github/ISSUE_TEMPLATE/config.yml` — URLs de Discussions e Security
- [ ] `sonar-project.properties` — `organization`, `projectKey`, `projectName`
- [ ] `README.md` — nome e descricao do produto

## B3. Branch protection em `main`

**Settings → Rules → Rulesets → New branch ruleset**

- [ ] Target: `main` (ou: Default branch)
- [ ] **Restrict deletions**
- [ ] **Block force pushes**
- [ ] **Require linear history**
- [ ] **Require a pull request before merging**
  - [ ] Required approvals: **1** (2 em time maior)
  - [ ] **Dismiss stale approvals when new commits are pushed**
  - [ ] **Require review from Code Owners**
  - [ ] **Require conversation resolution before merging**
- [ ] **Require status checks to pass**
  - [ ] **Require branches to be up to date before merging**
  - [ ] Check obrigatorio: **`ci-success`** — e so ele. Ele agrega
        convencoes, qualidade, testes, build, e2e, performance e SonarCloud;
        **nao** adicione os jobs um a um
  - [ ] Opcional: **Require code scanning results** (CodeQL) para bloquear
        merge com alerta de seguranca novo
- [ ] **Require signed commits** (se a organizacao exigir)
- [ ] Bypass list: vazia, ou so o time de plataforma

> Um check so aparece na lista depois de ter rodado ao menos uma vez.
> Abra um PR de teste antes de configurar esta secao.

## B4. GitHub Environments

**Settings → Environments → New environment.** Crie os quatro com
**exatamente** estes nomes (o `deploy.yml` os referencia):
`dev`, `test`, `homolog`, `prod`.

| Environment | Required reviewers | Wait timer | Deployment branches |
| --- | --- | --- | --- |
| `dev` | nao | 0 | `main` |
| `test` | nao | 0 | `main` + `release/*` |
| `homolog` | **sim** (1+) | 0 | `main` + `release/*` |
| `prod` | **sim** (2 recomendado) | 0 (ou 5 min para abortar) | `main` + tags `v*` |

**A aprovacao manual de homologacao e producao mora aqui**, nao no YAML. Por
isso o pipeline e identico para os quatro ambientes.

### Variables por environment

| Variable | Exemplo (`dev`) | Uso |
| --- | --- | --- |
| `APP_BASE_URL` | `https://dev.meu-app.com` | Smoke test e link do deployment |
| `API_BASE_URL` | `https://api-dev.meu-app.com` | Build |

### Secrets e variables da plataforma

Dependem da receita escolhida em [`DEPLOY.md`](DEPLOY.md). Exemplos:

| Plataforma | Secrets | Variables |
| --- | --- | --- |
| S3 + CloudFront | `AWS_ROLE_ARN` | `AWS_REGION`, `S3_BUCKET`, `CLOUDFRONT_DISTRIBUTION_ID` |
| Vercel | `VERCEL_TOKEN` | `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` |
| Netlify | `NETLIFY_AUTH_TOKEN` | `NETLIFY_SITE_ID` |
| Cloudflare | `CLOUDFLARE_API_TOKEN` | `CLOUDFLARE_ACCOUNT_ID`, `CF_PAGES_PROJECT` |
| GitHub Pages | — (usa o `GITHUB_TOKEN`; ver `DEPLOY.md`) | — |
| Container | credencial do registry | `REGISTRY`, `IMAGE_NAME` |

Repasse-os no passo `Publicar` do `.github/workflows/deploy.yml` — o bloco
`env:` ja tem exemplos.

- [ ] `dev` criado, com variables
- [ ] `test` criado
- [ ] `homolog` criado, **com required reviewers**
- [ ] `prod` criado, **com required reviewers**
- [ ] `scripts/deploy.sh` implementado (ver `DEPLOY.md`)

> Prefira sempre **OIDC** a chave de longa duracao. Em producao, restrinja a
> trust policy ao ambiente: com `:environment:prod` no `sub`, a credencial so
> pode ser obtida por um job que ja passou pela aprovacao.

## B5. SonarCloud

- [ ] Projeto criado em [sonarcloud.io](https://sonarcloud.io) e vinculado
- [ ] `sonar-project.properties` com `organization` e `projectKey` reais
- [ ] Caminhos de `sonar.sources` / `sonar.tests` batendo com a estrutura real
- [ ] **Administration → Analysis Method → Automatic Analysis: DESLIGADO**
      (conflita com a analise do CI e faz o scanner falhar)
- [ ] Secret `SONAR_TOKEN` — de preferencia na **organizacao**
      (Organization settings → Secrets and variables → Actions), assim
      todos os repositorios do projeto ja nascem com ele
- [ ] Dispensar o SonarCloud (prototipo, por exemplo) e uma decisao: passe
      `sonar: false` no `ci.yml` e registre o motivo em `STACK.md`
- [ ] Quality Gate definido (o padrao "Sonar way" serve para comecar)
- [ ] Primeiro run concluido e cobertura aparecendo (de `coverage/lcov.info`)

## B6. CodeQL

- [ ] Variable `CODEQL_LANGUAGES` definida se a stack nao for JS/TS.
      Valores: `javascript-typescript`, `python`, `java-kotlin`, `csharp`,
      `go`, `ruby`, `swift`, `c-cpp`, `rust`, `actions`.
      Aceita lista separada por virgula. Sem a variable, usa
      `javascript-typescript`.

## B7. AUTOMATION_TOKEN, GitHub Project e agente de automacao

Um unico token da organizacao serve a todas as automacoes que o
`GITHUB_TOKEN` nao cobre: GitHub Project, PR de release (que precisa
disparar o CI), release (que precisa disparar o deploy) e sincronizacao do
contrato de API.

- [ ] **Fine-grained PAT** com escopo **so na organizacao do projeto**,
      validade definida e lembrete de renovacao. Permissoes:
  - Repository: *Contents* RW, *Pull requests* RW, *Issues* RW, *Metadata* R
  - Organization: *Projects* RW
- [ ] Salvo como secret **`AUTOMATION_TOKEN` da organizacao**
- [ ] Project (v2) criado na organizacao
- [ ] Variable `PROJECT_URL` da organizacao = URL do Project
      (ex.: `https://github.com/orgs/SUA-ORG/projects/1`). Sem ela, so o
      passo do Project e pulado.
- [ ] Variable `COVERAGE_THRESHOLD` se a meta nao for 70

> Mais seguro, quando valer o esforco: uma **GitHub App** da organizacao,
> com token de curta duracao via `actions/create-github-app-token`.

## B8. Dependabot

`.github/dependabot.yml` vem com o ecossistema `github-actions` ativo
(universal) e os demais comentados.

- [ ] Descomentar o ecossistema da stack (`npm`, `bun`, `pip`, `docker`...)
- [ ] Ajustar os grupos aos pacotes reais do projeto

## B9. Labels

O agente cria as labels que usa na primeira vez que precisa delas. A lista
e a mesma em todos os repositorios do projeto (CONVENCOES.md do codex-base).
Para criar antes, com cores consistentes:

| Label | Cor | Uso |
| --- | --- | --- |
| `bug` | `d73a4a` | Defeito |
| `feature` | `0e8a16` | Funcionalidade nova |
| `documentacao` | `0075ca` | So documentacao |
| `acessibilidade` | `7057ff` | A11y |
| `performance` | `fbca04` | Bundle, CWV |
| `seguranca` | `b60205` | Vulnerabilidade |
| `dependencias` | `0366d6` | Dependabot |
| `ci-cd` | `5319e7` | Pipeline |
| `triagem-pendente` | `ededed` | Sem classificacao |
| `prioridade:alta` | `e11d21` | Urgente |
| `convencoes-pendentes` | `fef2c0` | PR fora do padrao |
| `size:grande` | `c5def5` | Issue longa |
| `contrato-api` | `1d76db` | Mudanca no contrato de API |
| `arquitetura` | `5319e7` | Decisao que afeta mais de um repositorio |
| `tech-debt` | `c2e0c6` | Divida tecnica |

## B9.1 Contrato de API (se o projeto tem docs/shared)

- [ ] Variable `CONTRACT_REPO` da organizacao = `org/repo` do docs/shared
- [ ] `GENERATE_TYPES_CMD` configurado em `project.mk` (ou `skip`)
- [ ] O docs/shared lista este repositorio em `CONTRACT_CONSUMERS`
- [ ] Rodar **Actions → Sync API types → Run workflow** uma vez e conferir o
      PR `chore(api): regenera tipos a partir do contrato`

## B9.2 Release

- [ ] `release-please-config.json`: trocar `release-type` pelo da stack
      (`node` para projetos com `package.json`) e apagar `version.txt` se o
      tipo novo nao usar
- [ ] Depois do primeiro merge em `main`, conferir o PR
      `chore(main): release 0.1.0` aberto pelo release-please

## B10. Verificacao final

- [ ] PR de teste a partir de `feature/teste-setup`
- [ ] CI roda todos os jobs e `ci-success` fica verde
- [ ] Merge bloqueado sem aprovacao
- [ ] Agente comentou convencoes e cobertura
- [ ] SonarCloud reportou
- [ ] `Closes #N` fechou a issue no merge
- [ ] Deploy para `dev` funcionando
- [ ] Deploy para `homolog` **parando na aprovacao**
- [ ] Se o roteamento for no cliente: URL profunda carrega a aplicacao
- [ ] **Apagar `SETUP-GITHUB.md` e `BOOTSTRAP.md`**, e remover as
      referencias a eles no `README.md`

---

## Resumo: secrets e variables

### Repositorio

| Nome | Tipo | Obrigatorio | Para que |
| --- | --- | --- | --- |
| `AUTOMATION_TOKEN` | secret (org) | para Project, release e contrato | `github-agent.yml`, `release.yml`, `sync-api-types.yml` |
| `SONAR_TOKEN` | secret (org) | sim, ou `sonar: false` | `ci.yml` |
| `PROJECT_URL` | variable (org) | para o Project | `github-agent.yml` |
| `CONTRACT_REPO` | variable (org) | se ha docs/shared | `sync-api-types.yml` |
| `CODEQL_LANGUAGES` | variable | se nao for JS/TS | `codeql.yml` |
| `COVERAGE_THRESHOLD` | variable | nao (padrao 70) | `github-agent.yml` |

### Por environment (`dev`, `test`, `homolog`, `prod`)

| Nome | Tipo | Obrigatorio | Para que |
| --- | --- | --- | --- |
| `APP_BASE_URL` | variable | nao | Smoke test e URL do deployment |
| `API_BASE_URL` | variable | conforme a stack | Build |
| Credenciais da plataforma | secret/variable | sim | `scripts/deploy.sh` |

`GITHUB_TOKEN` e automatico; nao crie.

---

## Problemas comuns

| Sintoma | Causa provavel |
| --- | --- |
| "workflow was not found" em `IgorOCosta/workflows/...@v1` | repositório de workflows privado, ou tag `v1` ainda nao criada (A1.1) |
| Todos os jobs do CI aparecem como pulados | O repositorio ainda esta marcado como *Template repository* |
| SonarCloud: "SonarCloud nao configurado" | Falta o secret `SONAR_TOKEN` (B5) |
| PR de release nao roda o CI | Release usando `GITHUB_TOKEN`: configure `AUTOMATION_TOKEN` (B7) |
| CI falha em `make setup` | `SETUP_CMD` vazio em `project.mk` — rode `make doctor` |
| CI falha com "make: command not found" | So acontece localmente no Windows; instale o make |
| Runtime errado no CI | `.tool-versions` vazio ou com versao diferente da local |
| Check nao aparece na branch protection | O workflow ainda nao rodou uma vez |
| SonarCloud: "running CI analysis while Automatic Analysis is enabled" | Desligue a Automatic Analysis (B5) |
| Cobertura zerada no Sonar e no PR | `make test-coverage` nao gera `coverage/lcov.info` |
| Deploy falha em "DEPLOY NAO IMPLEMENTADO" | `scripts/deploy.sh` ainda e o stub — ver `DEPLOY.md` |
| Deploy falha nas credenciais | Bloco de credencial comentado no `deploy.yml`, ou trust policy do OIDC nao casa com `repo:...` |
| Agente nao comenta no PR | PR vindo de fork: token somente-leitura, por design |
| "Add to project" falha | `AUTOMATION_TOKEN` ausente, expirado ou sem permissao de *Projects* |
| Deploy publica a API errada | Variavel resolvida em build: confira as variables daquele Environment |
