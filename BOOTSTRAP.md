# Bootstrap do projeto

Roteiro para transformar este template em um projeto real. Serve para uma
pessoa sozinha e serve como **instrucao de trabalho para um agente de IA**
(Claude Code ou equivalente).

> **Para o agente:** este documento e a sua tarefa quando o repositorio ainda
> esta em estado de template. Siga as etapas na ordem. Em cada uma: **faca as
> perguntas, espere a resposta, registre a decisao no arquivo indicado, e so
> entao avance.** Nao escolha stack, plataforma de deploy ou biblioteca por
> conta propria — mesmo que a escolha pareca obvia. Voce pode e deve
> **recomendar**, com o trade-off explicito, mas a decisao e de quem pediu.

**Como comecar, no projeto novo:**

```
Leia o BOOTSTRAP.md e me conduza pelas etapas.
```

---

## Estado atual do repositorio

Antes de perguntar qualquer coisa, rode:

```bash
make doctor
```

Ele mostra o que ja foi decidido e o que falta. Um alvo `nao configurado`
significa decisao pendente; `(skip)` significa decisao tomada de nao usar.

O que **ja** existe e nao precisa ser decidido:

| Area | Estado |
| --- | --- |
| Convencoes de branch e commit | Prontas, validadas em hook e CI |
| Governanca (issues, PR, CODEOWNERS) | Pronta, falta trocar os placeholders |
| Estrutura do CI | Pronta, falta preencher `project.mk` |
| Automacao do agente de GitHub | Pronta |
| CodeQL | Pronto, falta confirmar a linguagem |
| SonarCloud (dentro do CI) | Pronto, falta a conta |
| Release (versao + CHANGELOG) | Pronto, falta confirmar o `release-type` |
| Sincronizacao de tipos com o contrato | Pronta, falta apontar o docs/shared |
| Deploy: ambientes e aprovacao | Prontos, falta a plataforma |
| Esqueletos de documentacao | Prontos, faltam as decisoes |

O que **nao** existe, de proposito: stack, framework, ferramentas de teste,
plataforma de deploy, roteador, gerenciamento de estado, codigo.

---

## Etapa 1 — Contexto do projeto

**Pergunte:**

1. O que este produto faz, e para quem?
2. Que sistemas ele consome? (quais backends, quais contratos)
3. Em que estagio esta: prototipo descartavel, produto novo indo para
   producao, ou reescrita de algo existente?
4. Quem mantem: uma pessoa, um time, varios times?
5. Existe restricao da organizacao? (stack padronizada, nuvem obrigatoria,
   design system interno, exigencia de acessibilidade ou de auditoria)

A resposta 3 muda quase tudo o que vem depois. Um prototipo de duas semanas
nao precisa de e2e nem de orcamento de bundle; um produto de longa duracao
precisa dos dois desde cedo.

**Registre em:** `AGENTS.md` secao 1 · `README.md`

---

## Etapa 2 — Tipo de aplicacao

**Pergunte:** o conteudo precisa ser indexado por buscador, compartilhavel
com preview em rede social, ou aberto por usuario em conexao ruim?

| Resposta | Tipo | Consequencia |
| --- | --- | --- |
| Nao — e um app atras de login | **SPA** (renderizada no cliente) | Deploy estatico. Sem servidor. Sem SEO. |
| Sim — e publico e indexavel | **SSR/SSG** | Precisa de servidor ou plataforma de edge. |
| Parte publica, parte privada | **Hibrido** | SSG nas paginas publicas, cliente no app. |

Esta e a decisao com mais consequencia: ela determina o deploy, o Dockerfile,
como as variaveis de ambiente funcionam e se existe onde guardar segredo.

Explique o custo antes de registrar:

- **SPA**: o deploy e copiar arquivo para um bucket — sem servidor para
  manter, escalar ou monitorar. Em troca: buscador recebe HTML vazio, e a
  primeira pintura depende do JS baixar e executar.
- **SSR**: SEO e first paint bons, segredo pode ficar no servidor. Em troca:
  ha um processo em producao, com custo, escala e monitoramento.

**Registre em:** `STACK.md` secao 4 · `ARCHITECTURE.md` secao 1

---

## Etapa 3 — Stack

**Pergunte:**

1. Qual framework o time ja domina? (a resposta honesta costuma ser a certa)
2. Ha padrao na organizacao?
3. Tipagem estatica: sim ou nao? — se a resposta for "nao", confirme, porque
   isso desliga o alvo `typecheck` e afrouxa o contrato de API.
4. Gerenciador de pacotes e runtime: npm, pnpm, yarn, bun, deno?

**Nao recomende por moda.** Os criterios que valem: quem vai manter, o que
ja existe na organizacao, e o ferramental de qualidade disponivel — este
template exige lint de acessibilidade e de code smell, e nem todo ecossistema
tem os dois maduros.

**Depois de decidir, o agente deve:**

1. Inicializar o projeto com a ferramenta oficial da stack (`npm create
   vite@latest`, `npx nuxi init`, `ng new`, `npm create astro@latest`...).
   Nao escreva a mao o que um scaffolder faz melhor.
2. Preencher `.tool-versions` com a versao exata do runtime.
3. Preencher em `project.mk`: `SETUP_CMD`, `DEV_CMD`, `BUILD_CMD`,
   `PREVIEW_CMD`, `CLEAN_CMD`, `BUILD_DIR`.
4. Rodar `make setup && make build` e confirmar que passa.
5. Commitar o lockfile.

**Registre em:** `STACK.md` secoes 1 a 3 · `AGENTS.md` secao 2

---

## Etapa 4 — Qualidade

Nao ha o que perguntar sobre **se** havera lint e formatacao — o CI exige.
A pergunta e **com que ferramentas**, dado o ecossistema da etapa 3.

Requisitos que o `make lint` precisa cumprir, independentemente da stack:

| Requisito | Por que | Exemplos |
| --- | --- | --- |
| Erros de programacao | O basico | ESLint, Biome, `deno lint` |
| **Acessibilidade** | Descoberta em review humano chega tarde | `eslint-plugin-jsx-a11y`, `eslint-plugin-vuejs-accessibility`, a11y do Svelte |
| **Code smells / complexidade** | Alimenta o Quality Gate | `eslint-plugin-sonarjs` |
| Formatacao separada do lint | Formatacao nao e discussao de review | Prettier, Biome, `deno fmt` |

**Pergunte:** ESLint + Prettier (mais plugins, mais lento) ou Biome (uma
ferramenta so, muito mais rapido, menos plugins)? Se acessibilidade for
requisito duro, confirme que a opcao escolhida tem cobertura para a stack.

**Preencher em `project.mk`:** `LINT_CMD`, `LINT_FIX_CMD`, `FORMAT_CMD`,
`FORMAT_CHECK_CMD`, `TYPECHECK_CMD`.

Depois: `make validate` e `git commit` de teste (para exercitar os hooks).

**Registre em:** `STACK.md` secao 6 · `AGENTS.md` secao 3

---

## Etapa 5 — Testes

**Pergunte:**

1. Qual ferramenta de teste unitario/componente? (padrao do ecossistema)
2. Havera e2e desde o inicio? Se nao, `E2E_CMD = skip` — e uma decisao
   registrada, revisitavel, nao um esquecimento.
3. Qual o piso de cobertura? (70% e um comeco razoavel; o valor importa
   menos que ele existir e nao cair)
4. Quais fluxos justificam e2e? Criterio: se quebrar em producao, quanto
   custa? Se a resposta for "pouco", nao e e2e.

**Requisito tecnico:** `TEST_COVERAGE_CMD` precisa produzir
`coverage/lcov.info` — e o formato que o SonarCloud e o comentario de
cobertura no PR consomem.

**Preencher em `project.mk`:** `TEST_CMD`, `TEST_WATCH_CMD`,
`TEST_COVERAGE_CMD`, `E2E_CMD`, `E2E_INSTALL_CMD`.

Escreva ao menos um teste de verdade antes de seguir — nem que seja o smoke
test de "a home carrega". Um `make test` que passa sem testar nada da falsa
seguranca.

**Registre em:** `TESTING.md` · `STACK.md` secao 5

---

## Etapa 6 — Plataforma de deploy

**Pergunte:**

1. Onde a organizacao ja hospeda? (integrar ao que existe vence quase sempre)
2. Ha restricao de nuvem, regiao ou soberania de dados?
3. Quem opera em producao: o time do produto ou um time de plataforma?

| Tipo (etapa 2) | Opcoes comuns |
| --- | --- |
| SPA / estatico | S3 + CloudFront, Cloudflare Pages, Netlify, GitHub Pages, Azure Static Web Apps |
| SSR | Vercel, Netlify, Cloudflare Workers, container em Kubernetes/ECS/Cloud Run |

**Depois de decidir:**

1. Copie a receita de `DEPLOY.md` para `scripts/deploy.sh`.
2. Repasse os secrets/variables necessarios no passo `Publicar` do
   `.github/workflows/deploy.yml`.
3. Siga `SETUP-GITHUB.md` secao B4 para criar os quatro Environments.
4. Rode um deploy para `dev` e confirme que funciona.
5. Preencha a secao de rollback do `DEPLOY.md`.

**Nunca configure secret de producao sozinho.** Liste o que e preciso e peca
para a pessoa criar.

**Registre em:** `DEPLOY.md` · `STACK.md` secao 9

---

## Etapa 7 — Contrato de API

**Pergunte:**

1. O projeto tem um repositorio **docs/shared**? Qual (`org/repo`)?
   No modelo padrao, o backend gera o `openapi.yaml` a partir do codigo e o
   publica no docs/shared por PR; o shared avisa este repositorio, e o
   workflow `sync-api-types.yml` regenera os tipos e abre um PR aqui.
2. Se nao houver shared: o backend publica o contrato onde? (URL, artefato)
3. Ha outro formato alem de OpenAPI? (GraphQL schema, protobuf)

Se houver contrato, **gere os tipos** em vez de escreve-los a mao: tipo
escrito a mao envelhece em silencio; tipo gerado vira erro de compilacao no
dia em que o backend muda.

Se nao houver contrato, registre isso como risco em `ARCHITECTURE.md` — e
uma divida que cobra juros.

**Preencher em `project.mk`:** `GENERATE_TYPES_CMD`, `OPENAPI_SPEC`.
Sem contrato: `GENERATE_TYPES_CMD = skip`.

**Com docs/shared:** peca para configurar a variable `CONTRACT_REPO` da
organizacao (`SETUP-GITHUB.md` B9.1), confirme que este repositorio esta em
`CONTRACT_CONSUMERS` no shared, e rode o `Sync API types` uma vez.
Registre o shared na secao 1 do `AGENTS.md`: agentes precisam saber onde
ficam a arquitetura de sistema, as ADRs e o glossario.

**Camada de transporte:** independentemente da resposta, isole as chamadas
HTTP em um modulo proprio, com um tipo de erro proprio, e proiba chamada
direta no resto do codigo (regra de lint). O custo e de uma tarde; o
beneficio aparece na primeira troca de cliente HTTP ou na primeira vez que
alguem precisa adicionar retry em tudo.

**Registre em:** `ARCHITECTURE.md` secao 6 · `STACK.md` secao 8

---

## Etapa 8 — Performance

**Pergunte:** ha meta de performance acordada? Publico em conexao movel?

Dois controles, ambos plugaveis no contrato:

| Controle | Alvo | Ferramentas |
| --- | --- | --- |
| Orcamento de bundle | `BUNDLE_BUDGET_CMD` | size-limit, bundlesize, `bundlewatch` |
| Core Web Vitals | `PERF_CMD` | Lighthouse CI, Unlighthouse |

Ambos precisam **falhar**, nao so avisar — um orcamento que nao bloqueia nao
e orcamento.

Comece com limites folgados, medidos a partir do build real, e aperte depois.
Limite irreal e desligado na primeira semana.

`skip` e aceitavel em prototipo. Em produto de longa duracao, adiar isso
significa descobrir o problema quando ja e caro consertar.

**Registre em:** `ARCHITECTURE.md` secao 8

---

## Etapa 9 — Decisoes em aberto

Estas nao precisam ser tomadas hoje, mas precisam ser **conscientes**.
Pergunte uma por uma; "ainda nao" e resposta valida e deve ser registrada.

| Decisao | Pergunta que revela a necessidade |
| --- | --- |
| Roteador | Ha mais de uma tela? Rota protegida? URL compartilhavel? |
| Estado de servidor | Ha cache de resposta de API? Revalidacao? Offline? |
| Estado global de UI | Tema, idioma, notificacao — ou `useState` basta? |
| Formularios | Quantos campos, que validacao, validacao no servidor? |
| Design | Onde nasce o visual (Claude Design, Figma, design system da organizacao)? Ha tokens exportaveis? A ferramenta exporta codigo? |
| i18n | Mais de um idioma, hoje ou no roadmap? |
| Observabilidade | Como voce descobre que quebrou em producao? |

A maior parte do que vira "estado global" e, na verdade, **cache de
servidor** — problema de biblioteca de data fetching, nao de store.

**Registre em:** `STACK.md` secao 10 · `ARCHITECTURE.md` secoes 3 e 4 ·
design em `ARCHITECTURE.md` secao 5 ("Design e tokens") e na linha "Fonte do
design" do `AGENTS.md` secao 1

---

## Etapa 10 — Fechamento

Nesta ordem:

1. **Reescreva o `AGENTS.md`.** Apague tudo que fala do template e preencha
   as sete secoes com a realidade do projeto. Sem isso, todo agente futuro
   comeca com a premissa errada.
2. **Reescreva o `README.md`** para o produto (nao para o template).
3. **Troque os placeholders:** `SUA-ORG` e `SEU-REPOSITORIO` em
   `.github/CODEOWNERS`, `.github/ISSUE_TEMPLATE/config.yml` e
   `sonar-project.properties` (`make doctor` lista o que sobrou).
4. **Release:** troque `release-type` em `release-please-config.json` pelo
   da stack (`node` quando ha `package.json`) e apague `version.txt` se o
   tipo novo nao usar.
5. **Rode `SETUP-GITHUB.md` parte B** — branch protection, Environments,
   SonarCloud, `AUTOMATION_TOKEN`, Project, contrato.
6. **Apague** `BOOTSTRAP.md` e `SETUP-GITHUB.md`. Cumpriram a funcao.
7. **Abra um PR de teste** e confirme, de ponta a ponta: CI verde, agente
   comentando, merge bloqueado sem aprovacao, issue fechando por `Closes #N`,
   PR de release aberto depois do merge.

### Criterio de pronto

```bash
make doctor      # nenhum obrigatorio pendente
make validate    # passa
make build       # passa
make e2e         # passa ou (skip) consciente
```

- [ ] `AGENTS.md` fala do projeto, nao do template
- [ ] Nenhum `SUA-ORG` sobrou no repositorio
- [ ] Todo `skip` em `project.mk` e uma decisao registrada na documentacao
- [ ] Deploy para `dev` funcionou de verdade
- [ ] `homolog` para na aprovacao
- [ ] `BOOTSTRAP.md` e `SETUP-GITHUB.md` apagados

---

## Regras para o agente durante o bootstrap

- **Uma etapa por vez.** Nao despeje as dez perguntas de uma vez.
- **Recomende com trade-off, decida nunca.** "Eu sugiro X porque Y, mas custa
  Z" — e entao espere.
- **Registre antes de avancar.** Decisao que nao foi escrita em arquivo nao
  aconteceu; daqui a seis meses ninguem lembra do motivo.
- **Rode o que voce configurou.** Depois de preencher `project.mk`, execute o
  alvo. Nao declare pronto sem ter visto passar.
- **`skip` e decisao, nao atalho.** Use quando a pessoa decidir nao usar, e
  registre onde a documentacao pede. Nunca para fazer o CI ficar verde.
- **Nao afrouxe a fundacao para caber na stack.** Se uma regra do template
  atrapalha de verdade, diga qual e por que, e deixe a pessoa decidir.
- **Pare e pergunte** em tudo que estiver na secao 6 do `AGENTS.md`:
  secrets, workflows, deploy em ambiente real, dependencia nova.
