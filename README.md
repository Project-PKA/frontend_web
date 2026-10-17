# template-frontend

Repositorio **template**: a fundacao de qualidade, CI/CD e documentacao que
todo projeto de frontend deve ter desde o primeiro commit.

**Sem stack.** Nao ha framework, ferramenta de teste nem plataforma de deploy
escolhida aqui — isso e decidido no projeto novo, com o contexto do projeto
novo. O que existe e tudo o que normalmente so aparece no terceiro mes,
quando ja e tarde: CI, convencoes, governanca, automacao e os esqueletos de
documentacao.

---

## Como isso funciona sem stack

A fundacao conversa com a stack por um **contrato de comandos**:

```
  CI, hooks, documentacao
            │
            │  make setup · make lint · make test · make build · make deploy
            ▼
      Makefile            ← contrato. Voce nao edita.
            │
            ▼
      project.mk          ← os comandos reais. O unico acoplamento com a stack.
            │
            ▼
   npm · pnpm · bun · deno · vite · webpack · o que for
```

Nenhum workflow sabe qual e a sua stack. Trocar de ferramenta, de
gerenciador de pacotes ou de runtime muda **um** arquivo: `project.mk`.
Trocar de plataforma de deploy muda outro: `scripts/deploy.sh`.

Um alvo ainda nao configurado falha com instrucao explicita. Um alvo que nao
se aplica ao projeto recebe `skip` — decisao registrada, nao esquecimento.

```
$ make lint

FALTA CONFIGURAR: LINT_CMD

  Defina LINT_CMD em project.mk
  Nao se aplica a este projeto? use:  LINT_CMD = skip

  ex.: npx eslint . --max-warnings=0
```

---

## Como usar

### 1. Crie o repositorio pelo botao "Use this template"

No GitHub: **Use this template → Create a new repository**.

Nao use `fork`: fork mantem vinculo com o upstream, herda issues e PRs, e
aparece como "forked from" — nada disso faz sentido para um projeto novo.

### 2. Rode o bootstrap com um agente de IA (ou sozinho)

```
Leia o BOOTSTRAP.md e me conduza pelas etapas.
```

Abra o Claude Code **dentro deste repositorio**, com o docs/shared do projeto
clonado ao lado e acessivel (no terminal: `claude --add-dir ../<projeto>-shared`).
O `CLAUDE.md` daqui e carregado no inicio, e o agente le as decisoes de
sistema de la.

[`BOOTSTRAP.md`](BOOTSTRAP.md) e um roteiro de dez etapas: contexto, tipo de
aplicacao, stack, qualidade, testes, deploy, contrato de API, performance,
decisoes em aberto e fechamento. Em cada etapa ele diz **o que perguntar**,
**que trade-off explicar** e **onde registrar a resposta**.

Escrito para funcionar com Claude Code, mas legivel por qualquer pessoa.

### 3. Acompanhe o progresso

```bash
make doctor
```

Mostra o que ja foi decidido, o que foi explicitamente dispensado (`skip`) e
o que ainda falta. Sai com erro enquanto houver obrigatorio pendente.

### 4. Configure o GitHub

[`SETUP-GITHUB.md`](SETUP-GITHUB.md) lista tudo que so pode ser feito pela
interface: Template Repository, branch protection, Environments com secrets
e aprovacao, SonarCloud, CodeQL, Project. Nenhum arquivo do repositorio
consegue fazer isso por voce.

---

## O que vem pronto

**CI/CD**

- CI em todo PR: convencoes, formato, lint, tipos, testes, build, orcamento
  de bundle, e2e e Core Web Vitals — tudo pelo contrato do `Makefile`
- Um unico status check (`ci-success`) para a branch protection
- Deploy parametrizado por **GitHub Environment** (dev / test / homolog /
  prod), nao por branch, com aprovacao manual onde importa
- Publicacao isolada em `scripts/deploy.sh`; receitas para S3+CloudFront,
  Vercel, Netlify, Cloudflare e container em [`DEPLOY.md`](DEPLOY.md)
- Runtime instalado a partir de `.tool-versions` (mise/asdf)
- Versao e CHANGELOG automaticos (release-please), com deploy para `prod`
  disparado pela release
- Tipos de API regenerados por PR automatico quando o contrato publicado no
  docs/shared muda (`sync-api-types.yml`)
- A logica dos workflows mora em `IgorOCosta/workflows` (reutilizaveis `@v1`):
  melhorias la chegam a todos os projetos sem PR em cada um

**Qualidade e seguranca**

- SonarCloud com Quality Gate bloqueante, dentro do `ci-success`
- CodeQL (SAST) em PR, push e semanalmente
- Dependabot para GitHub Actions (demais ecossistemas: exemplos comentados)
- Secret scanning e push protection no checklist de configuracao

**Governanca**

- Templates de issue (bug, feature) e de pull request
- `CODEOWNERS` com review obrigatorio por area
- Conventional Commits e nome de branch validados em **shell puro**, nas
  mesmas regras, no hook local e no CI
- Hooks de git versionados em `.githooks/`, sem Husky e sem runtime

**Agente de automacao do GitHub**

- Rotula issues por conteudo
- Adiciona issues e PRs a um GitHub Project
- Comenta o diagnostico de convencoes e sugere reviewers via CODEOWNERS
- Publica resultado do CI e cobertura como comentario fixo no PR
- Fecha issues vinculadas por `Closes #N` no merge

**Documentacao viva**

| Arquivo | Para que serve |
| --- | --- |
| [`BOOTSTRAP.md`](BOOTSTRAP.md) | Roteiro de decisoes do projeto novo |
| [`AGENTS.md`](AGENTS.md) | Contexto para pessoas e agentes. **Comece por aqui.** |
| [`SETUP-GITHUB.md`](SETUP-GITHUB.md) | O que so da para fazer na interface do GitHub |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | Estrutura, estado, roteamento, fluxo de telas |
| [`TESTING.md`](TESTING.md) | Criterio de teste de componente vs e2e |
| [`STACK.md`](STACK.md) | Formato para registrar por que cada escolha foi feita |
| [`DEPLOY.md`](DEPLOY.md) | Modelo de ambientes e receitas por plataforma |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | Fluxo de contribuicao |

---

## Requisitos

| Ferramenta | Para que | Obrigatorio |
| --- | --- | --- |
| `git` | — | Sim |
| `make` | Contrato de comandos | Sim |
| `mise` ou `asdf` | Instalar o runtime de `.tool-versions` | Recomendado |
| Runtime da stack | Definido no bootstrap | Depois da etapa 3 |

**Windows:** `make` nao vem instalado.

```bash
winget install ezwinports.make
```

Alternativas: `choco install make`, MSYS2, ou WSL. Os hooks de git e os
validadores rodam em `sh` — funcionam no Git Bash sem instalar nada.

---

## Manutencao do template

Entra aqui: workflow, script de convencao, esqueleto de documentacao,
receita de deploy, exemplo em `project.mk`.

**Nao entra:** stack, framework, `package.json`, dependencia, plataforma de
deploy fixa, qualquer coisa que so faca sentido para um projeto especifico.

Projetos ja criados nao recebem atualizacao automatica dos arquivos —
"Use this template" copia, nao vincula. O que e politica comum (CI,
convencoes, agente, release) fica nos workflows centrais (`IgorOCosta/workflows`) e
chega a todos pela tag `v1`. O resto (documentacao, `Makefile`), avise os
times que usam o template.

As convencoes (branches, ambientes, labels, secrets) sao as do
`CONVENCOES.md` do `codex-base` — este template as implementa, nao as define.
