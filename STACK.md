# Stack

> **Esqueleto do template.** Este repositorio nao escolhe stack: ele fornece
> o **formato** para registrar as escolhas do projeto e o criterio para
> faze-las. As perguntas de cada secao sao conduzidas pelo
> [`BOOTSTRAP.md`](BOOTSTRAP.md).
>
> O valor deste arquivo nao esta na lista de ferramentas — esta em registrar
> o **criterio** e a **alternativa descartada**. Daqui a um ano, quando
> alguem perguntar "por que nao usamos X?", a resposta precisa estar escrita.

---

## O formato

Para cada escolha relevante, registre cinco coisas:

1. **Escolha** — o que foi adotado, com versao.
2. **Criterio** — o que importava na hora de decidir.
3. **Por que** — como a escolha atende o criterio.
4. **Descartado** — o que mais foi considerado e por que nao.
5. **Quando reabrir** — que fato tornaria essa decisao errada.

O item 5 e o mais esquecido e o mais util: transforma a decisao em algo
revisavel, em vez de dogma. Sem ele, toda escolha vira permanente por
inercia.

---

## Resumo

<!-- Preencha durante o bootstrap. -->

| Camada | Escolha | Versao | Secao |
| --- | --- | --- | --- |
| Tipo de aplicacao | Hibrido: SSG (landing, termos, privacidade) + SPA (app, /admin, paginas por token) | — | 1 |
| Framework de UI | Vue 3 + Nuxt (estatico, `nuxi generate`) | ver `package.json` | 2 |
| Linguagem | TypeScript estrito | ver `package.json` | 3 |
| Runtime e gerenciador de pacotes | Node 22 + npm 10.9 | 22.23.3 | 3 |
| Build | Nuxt (Vite) | ver `package.json` | 3 |
| Lint e formatacao | ESLint (+ a11y Vue, sonarjs) e Prettier | ver `package.json` | 4 |
| Testes unitarios/componente | Vitest + Vue Testing Library | ver `package.json` | 5 |
| Testes e2e | Playwright | ver `package.json` | 5 |
| Estilo | <!-- --> | <!-- --> | 6 |
| Contrato de API | `openapi-typescript` (so tipos) + cliente fino proprio | ver `package.json` | 7 |
| Plataforma de deploy | Mesma VPS do Backend, proxy reverso (execucao pendente: A7) | — | 8 |

As versoes exatas do runtime ficam em `.tool-versions`; os comandos, em
`project.mk`.

---

## 1. Tipo de aplicacao

A decisao com mais consequencia: ela determina o deploy, o Dockerfile, como
as variaveis de ambiente funcionam e se existe onde guardar segredo.

**A pergunta que decide:** o conteudo precisa ser indexado por buscador,
compartilhavel com preview em rede social, ou aberto por usuario em conexao
ruim?

| Tipo | Ganha | Perde |
| --- | --- | --- |
| **SPA** (cliente) | Deploy e copiar arquivo. Sem servidor para manter, escalar ou monitorar. Custo quase zero. | SEO (crawler recebe HTML vazio). First paint depende do JS. Nenhum segredo possivel. |
| **SSR** | SEO, first paint, segredo no servidor, dado fresco por requisicao. | Ha um processo em producao: custo, escala, monitoramento, mais superficie de falha. |
| **SSG** | Rapido e barato como SPA, indexavel como SSR. | Conteudo precisa ser conhecido em build; rebuild a cada mudanca. |

**Escolha:** Hibrido. Landing, Termos de uso e Politica de Privacidade
estaticas (SSG, indexaveis). App logado, `/admin` e paginas publicas por token
(acerto, consignador) como SPA, com `noindex` e `Referrer-Policy: no-referrer`.
A vitrine publica fica como pagina de cliente (dado ao vivo); se precisar ser
indexavel, reabrir.
**Criterio:** SEO so onde ha ganho (landing); sem servidor para manter (um
mantenedor); token no fragmento da URL nunca pode chegar a servidor ou log.
**Por que:** o conteudo indexavel e conhecido em build; o resto e atras de
login ou de token, onde SEO e indesejado. Evita processo SSR em producao.
**Descartado:** SSR completo (custo operacional sem ganho no app logado); tudo
SPA (landing com HTML vazio para buscador).
**Quando reabrir:** se a vitrine precisar de SEO, ou se surgir conteudo
dinamico indexavel.

### Consequencias registradas

- Deploy estatico (arquivos em CDN/bucket/servidor web), sem processo Node em
  producao. Plataforma ainda a decidir (etapa 6).
- Variaveis de ambiente resolvidas em **build** (URL da API): cada ambiente
  refaz o build, sem "build once, deploy many" (a revisar na etapa 6).
- Fallback de rota para `index.html` nas rotas da SPA; paginas estaticas servidas
  como arquivos proprios.
- Sem segredo no frontend: nada sensivel em variavel de ambiente.
- Cabecalhos (`Referrer-Policy`, CSP, `X-Robots-Tag`) precisam ser definidos na
  camada de hospedagem, nao so em `<meta>`.

---

## 2. Framework de UI

**Criterios que valem** (em ordem de peso, na experiencia da maioria dos
times):

1. **Quem vai manter.** O framework que o time domina vence quase sempre o
   framework "melhor".
2. **Padrao da organizacao.** Divergir tem custo em contratacao, code review
   e rotacao de pessoas.
3. **Ferramental de qualidade.** Este template exige lint de acessibilidade e
   de code smell — nem todo ecossistema tem os dois maduros.
4. **Tamanho do problema.** App de uma tela e app de duzentas telas nao
   pedem a mesma coisa.

Criterio que **nao** vale: benchmark de runtime. Em frontend de produto, o
gargalo quase nunca e o framework.

**Escolha:** Vue 3 com Nuxt em modo estatico (`nuxi generate`); rotas do app,
`/admin` e paginas por token com `routeRules` `ssr: false`; landing, termos e
privacidade pre-renderizadas.
**Criterio:** dominio do mantenedor (Vue); hibrido SSG + SPA nativo; roteamento,
`<head>` e i18n integrados para um mantenedor so.
**Por que:** um unico projeto cobre as paginas indexaveis e a SPA, sem servidor
em producao.
**Descartado:** React (preferencia do mantenedor e Vue); Vite + vite-ssg (mais
enxuto, mas exige montar roteamento, head e pre-render por conta propria).
**Quando reabrir:** se o Nuxt travar atualizacoes de dependencia, ou se o app
nao precisar mais do hibrido.

---

## 3. Linguagem, runtime e build

**Tipagem estatica.** Se a resposta for nao, registre o motivo: isso desliga
o alvo `typecheck` (`TYPECHECK_CMD = skip`) e enfraquece o contrato de API da
secao 7. E uma escolha legitima em prototipo; e cara em produto de longa
duracao.

**Escolha:** TypeScript em modo estrito; Node 22 (22.23.3 em `.tool-versions`);
npm 10.9 com `package-lock.json`; build do Nuxt (Vite).
**Criterio:** o projeto pede Node 22; tipos gerados do OpenAPI exigem
tipagem estatica; npm vem com o Node e funciona no Windows sem passo extra.
**Por que:** tipo gerado vira erro de compilacao quando o Backend muda.
**Descartado:** JavaScript puro (enfraquece o contrato); pnpm (ganho pequeno
para um mantenedor, mais um passo de instalacao no CI).
**Quando reabrir:** se o tempo de instalacao no CI virar problema.

Versoes exatas em `.tool-versions` — e o que garante que a sua maquina, a do
colega e o CI rodem a mesma coisa.

---

## 4. Lint, formatacao e analise

Quatro camadas, cada uma pegando uma coisa diferente. Nenhuma substitui as
outras:

| Camada | Escopo | Pega |
| --- | --- | --- |
| Formatador | Sintaxe | Discussao de estilo em code review |
| Linter | Arquivo isolado | Bug de padrao, acessibilidade, complexidade |
| SonarCloud | Projeto inteiro | Duplicacao, cobertura de codigo novo, hotspot |
| CodeQL | Fluxo de dados entre arquivos | XSS, injecao, dado nao sanitizado no DOM |

**Requisitos do `make lint`, independentemente da ferramenta:**

- [ ] Regras de acessibilidade — descoberta em review humano chega tarde
- [ ] Regras de complexidade / code smell
- [ ] Formatacao verificada separadamente (`make format-check`)
- [ ] Falha em warning no CI, nao so em error

**Escolha:** ESLint (flat config, via `@nuxt/eslint`) com
`eslint-plugin-vuejs-accessibility` e `eslint-plugin-sonarjs`; Prettier para
formatacao; `vue-tsc` para tipos. Lint com `--max-warnings=0`.
**Criterio:** acessibilidade WCAG AA e code smells sao requisitos; cobertura
madura para Vue.
**Por que:** e a combinacao com regras de a11y para templates Vue e o
ecossistema do Nuxt.
**Descartado:** Biome (mais rapido, mas sem cobertura equivalente de
acessibilidade em templates Vue).
**Quando reabrir:** se o Biome ganhar regras de a11y para Vue, ou se o lint
ficar lento.

---

## 5. Testes

**Requisito tecnico:** `make test-coverage` precisa produzir
`coverage/lcov.info`. E o formato que o SonarCloud e o comentario de
cobertura no PR consomem, e praticamente toda ferramenta sabe emitir.

**Escolha:** Vitest + Vue Testing Library (unidade e componente); Playwright
(e2e desde o inicio, nos 9 fluxos de `TESTING.md`, com a API simulada por rota).
**Criterio:** integracao nativa com Vite/Nuxt; consulta por papel acessivel;
e2e nos fluxos em que falha custa caro.
**Por que:** o Backend precisa de banco e e-mail, entao e2e contra ele nao e
reprodutivel no CI; o contrato tipado reduz o risco de divergencia.
**Descartado:** Jest (mais configuracao com Vite); Cypress; e2e contra o Backend
real (revisitar quando houver ambiente `test` estavel).
**Quando reabrir:** se a simulacao de API divergir do Backend em producao.

**Piso de cobertura:** 70% global; 85% nos modulos criticos — o valor importa menos que ele existir e
nao cair.

O criterio de **o que testar onde** esta em [`TESTING.md`](TESTING.md).

---

## 6. Estilo

**Escolha:** <!-- CSS Modules, Tailwind, CSS-in-JS, design system da org -->
**Criterio:** <!-- -->
**Por que:** <!-- -->
**Descartado:** <!-- -->
**Quando reabrir:** <!-- -->

Perguntas que costumam decidir: ha design system na organizacao? O escopo de
estilo precisa ser garantido pela ferramenta? Custo de runtime e aceitavel?
Quem escreve CSS no time?

---

## 7. Contrato de API

**A pergunta:** o backend publica um contrato (OpenAPI, GraphQL schema,
protobuf)?

**Se sim**, gere os tipos em vez de escreve-los. Tipo escrito a mao envelhece
em silencio; tipo gerado vira erro de compilacao no dia em que o backend
muda — nao no dia em que um usuario reclama. O contrato mora no **backend**;
nao mantenha copia aqui.

**Se nao**, registre como risco em `ARCHITECTURE.md`. E divida que cobra
juros.

**Escolha:** `openapi-typescript` gera so os tipos (`app/api/generated.ts`);
cliente fino proprio sobre `fetch`, com `ApiError` (RFC 9457) e regra de lint
contra `fetch` fora de `app/api/`. Detalhes em `ARCHITECTURE.md` secao 6.
**Onde mora o contrato:** `Project-PKA/shared` (`openapi.yaml`), gerado pelo
Backend (`../Backend/docs/api/openapi.yaml` localmente).
**Quem avisa quando muda:** o `shared` dispara o `sync-api-types.yml` deste
repositorio, que abre PR. Exige `CONTRACT_REPO=Project-PKA/shared` e o secret
`AUTOMATION_TOKEN` (A2 em `shared/OWNER.md`, a criar pelo dono).
**Descartado:** cliente gerado (`openapi-fetch` ou similar): menos codigo, mas
o refresh, o `x-store-id` e o `ApiError` precisariam de adaptacao de qualquer
forma e a dependencia ficaria acoplada ao gerador.

---

## 8. Plataforma de deploy

**Escolha:** arquivos estaticos (saida de `nuxi generate`) servidos pela
**mesma VPS do Backend**, atras do proxy reverso. **Decisao tomada, execucao
pendente:** depende de VPS e dominio (A7 em `shared/OWNER.md`). Sem isso nao
ha deploy real nem smoke test publicado.
**Criterio:** controlar cabecalhos (CSP, `Referrer-Policy: no-referrer`,
`X-Robots-Tag: noindex` nas rotas privadas e por token); manter o cookie
`refresh_token` (httpOnly) no mesmo site da API; dados na infraestrutura do
proprio produto (LGPD); um unico operador.
**Por que:** o proxy reverso aplica os cabecalhos por rota, o que um `<meta>`
nao garante; app e API no mesmo site evitam cookie de terceiros.
**Descartado:** plataforma de borda (Cloudflare Pages, Netlify, S3 + CDN):
cabecalhos e cookie entre sites exigiriam configuracao extra, e traria mais um
operador de dados.
**Quando reabrir:** se o trafego da landing exigir CDN; ou se a VPS virar
gargalo. A landing poderia ir para a borda sem tocar o app.

O modelo de ambientes (dev / test / homolog / prod, aprovacao em homologacao
e producao) **nao** depende da plataforma e ja esta pronto. So a publicacao
em si e especifica — ver [`DEPLOY.md`](DEPLOY.md).

Preferir sempre credencial de curta duracao (OIDC) a chave de longa duracao.

---

## 9. Decisoes em aberto

Nao precisam ser tomadas no primeiro dia, mas precisam ser **conscientes**.
"Ainda nao" e resposta valida — desde que registrada.

| Decisao | Pergunta que revela a necessidade | Status |
| --- | --- | --- |
| Roteador | Ha mais de uma tela? Rota protegida? URL compartilhavel? | Decidido: roteador do Nuxt, URLs em ingles, middleware de guarda (ARCHITECTURE.md secao 4) |
| Estado de servidor | Ha cache de resposta de API? Revalidacao? Offline? | Decidido: TanStack Query (`@tanstack/vue-query`), polling por componente |
| Estado global de UI | Tema, idioma, notificacao — ou o estado local basta? | Decidido: Pinia so para sessao, loja atual, idioma e tema |
| Formularios | Quantos campos? Que validacao? Valida no servidor? | Decidido: VeeValidate + Zod; servidor sempre vale |
| Design | Fonte do visual (Claude Design, Figma, design system da org) e onde ficam os tokens | Decidido: Claude Design; CSS global do `design-system`, sem Tailwind, fontes via Fontsource |
| i18n | Mais de um idioma, hoje ou no roadmap? | Decidido: `@nuxtjs/i18n` (vue-i18n), `en` e `pt-BR` (ADR 0017); landing em `/` (en) e `/pt-BR/` com hreflang |
| Observabilidade | Como voce descobre que quebrou em producao? | Sem telemetria de terceiros; GlitchTip na VPS depois de A7, sem dado pessoal nem fragmento da URL |

Dependencias citadas aqui (TanStack Query, Pinia, VeeValidate, Zod,
`@nuxtjs/i18n`, Fontsource, `openapi-typescript`, Lighthouse CI, o script `bundle-budget`,
Playwright, Vitest) ainda precisam de aprovacao explicita ao instalar.

> A maior parte do que vira "estado global" e, na verdade, **cache de
> servidor**: resposta de API com invalidacao e revalidacao. Isso e problema
> de biblioteca de data fetching, nao de store global. Confundir os dois e a
> origem mais comum de arquitetura de estado inflada.

---

## 10. Registro de decisoes posteriores

<!--
Escolhas feitas depois do bootstrap, no mesmo formato de cinco itens.
Se uma decisao precisar de mais de um paragrafo, escreva um ADR em
docs/adr/ e aponte para ele aqui.

### <Decisao> — <data>
**Escolha:**
**Criterio:**
**Por que:**
**Descartado:**
**Quando reabrir:**
-->
