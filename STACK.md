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
| Tipo de aplicacao | <!-- SPA / SSR / SSG / hibrido --> | — | 1 |
| Framework de UI | <!-- --> | <!-- --> | 2 |
| Linguagem | <!-- --> | <!-- --> | 3 |
| Runtime e gerenciador de pacotes | <!-- --> | <!-- --> | 3 |
| Build | <!-- --> | <!-- --> | 3 |
| Lint e formatacao | <!-- --> | <!-- --> | 4 |
| Testes unitarios/componente | <!-- --> | <!-- --> | 5 |
| Testes e2e | <!-- --> | <!-- --> | 5 |
| Estilo | <!-- --> | <!-- --> | 6 |
| Contrato de API | <!-- --> | <!-- --> | 7 |
| Plataforma de deploy | <!-- --> | — | 8 |

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

**Escolha:** <!-- -->
**Criterio:** <!-- -->
**Por que:** <!-- -->
**Descartado:** <!-- -->
**Quando reabrir:** <!-- ex.: se SEO virar requisito -->

### Consequencias registradas

<!--
Escreva o que essa escolha ja determinou, para ninguem redescobrir depois:
  - Onde o deploy publica
  - Se a variavel de ambiente e resolvida em build ou em runtime
  - Se um artefato pode ser promovido entre ambientes
  - Se o servidor precisa de fallback de rota
-->

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

**Escolha:** <!-- -->
**Criterio:** <!-- -->
**Por que:** <!-- -->
**Descartado:** <!-- -->
**Quando reabrir:** <!-- -->

---

## 3. Linguagem, runtime e build

**Tipagem estatica.** Se a resposta for nao, registre o motivo: isso desliga
o alvo `typecheck` (`TYPECHECK_CMD = skip`) e enfraquece o contrato de API da
secao 7. E uma escolha legitima em prototipo; e cara em produto de longa
duracao.

**Escolha:** <!-- linguagem, runtime, gerenciador de pacotes, bundler -->
**Criterio:** <!-- -->
**Por que:** <!-- -->
**Descartado:** <!-- -->
**Quando reabrir:** <!-- -->

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

**Escolha:** <!-- -->
**Criterio:** <!-- -->
**Por que:** <!-- -->
**Descartado:** <!-- ex.: Biome vs ESLint+Prettier -->
**Quando reabrir:** <!-- -->

---

## 5. Testes

**Requisito tecnico:** `make test-coverage` precisa produzir
`coverage/lcov.info`. E o formato que o SonarCloud e o comentario de
cobertura no PR consomem, e praticamente toda ferramenta sabe emitir.

**Escolha:** <!-- unitario/componente + e2e -->
**Criterio:** <!-- -->
**Por que:** <!-- -->
**Descartado:** <!-- -->
**Quando reabrir:** <!-- -->

**Piso de cobertura:** <!-- % --> — o valor importa menos que ele existir e
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

**Escolha:** <!-- gerador, ou `skip` -->
**Onde mora o contrato:** <!-- URL / repositorio / artefato -->
**Quem avisa quando muda:** <!-- -->
**Descartado:** <!-- ex.: gerar o cliente inteiro vs so os tipos -->

---

## 8. Plataforma de deploy

**Escolha:** <!-- -->
**Criterio:** <!-- onde a org ja hospeda, restricao de nuvem, quem opera -->
**Por que:** <!-- -->
**Descartado:** <!-- -->
**Quando reabrir:** <!-- -->

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
| Roteador | Ha mais de uma tela? Rota protegida? URL compartilhavel? | <!-- --> |
| Estado de servidor | Ha cache de resposta de API? Revalidacao? Offline? | <!-- --> |
| Estado global de UI | Tema, idioma, notificacao — ou o estado local basta? | <!-- --> |
| Formularios | Quantos campos? Que validacao? Valida no servidor? | <!-- --> |
| Design | Fonte do visual (Claude Design, Figma, design system da org) e onde ficam os tokens | <!-- --> |
| i18n | Mais de um idioma, hoje ou no roadmap? | <!-- --> |
| Observabilidade | Como voce descobre que quebrou em producao? | <!-- --> |

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
