# Estrategia de testes

> **Esqueleto do template.** O criterio (o que testar onde) vale como esta,
> em qualquer stack. As secoes com `<!-- -->` sao do projeto e sao
> preenchidas na etapa 5 do [`BOOTSTRAP.md`](BOOTSTRAP.md).

---

## A pergunta central: componente ou e2e?

> **Teste de componente** responde "este pedaco se comporta certo?".
> **Teste e2e** responde "as pecas juntas entregam o resultado?".

Se voce consegue provar a regra com o componente isolado, ela **nao** deve
virar teste e2e. E2e e caro: roda o build, sobe o servidor, abre o browser, e
falha por motivos que nao sao o seu bug. Uma suite e2e inflada e a principal
razao pela qual times acabam desligando os testes.

### Tabela de decisao

| O que voce quer provar | Componente | E2E |
| --- | :-: | :-: |
| Regra de validacao de formulario | ✅ | ❌ |
| Mensagem de erro aparece com input invalido | ✅ | ❌ |
| Renderiza os quatro estados (carregando, vazio, erro, sucesso) | ✅ | ❌ |
| Callback chamado com o argumento certo | ✅ | ❌ |
| Componente acessivel por teclado | ✅ | ❌ |
| Formatacao de data, moeda, numero | ✅ (funcao pura) | ❌ |
| Logica condicional de exibicao | ✅ | ❌ |
| **O app carrega sem quebrar** | ❌ | ✅ |
| Navegacao entre telas | ❌ | ✅ |
| Fluxo completo (login → acao → confirmacao) | ❌ | ✅ |
| Sessao persiste entre recarregamentos | ❌ | ✅ |
| Integracao real com a API | ❌ | ✅ |
| URL profunda funciona (fallback de rota no servidor) | ❌ | ✅ |
| Layout nao quebra em 320px | ❌ | ✅ |

### Em caso de duvida

1. Da para provar sem browser? → componente.
2. O valor esta em **varias pecas juntas**? → e2e.
3. Nao sabe? → escreva o de componente. Se ele passar e o bug continuar
   acontecendo em producao, voce descobriu que era e2e.

---

## Piramide

```
        /\        e2e            — poucos, so caminhos criticos
       /  \
      /----\      componente     — a maior parte
     /      \
    /--------\    unitario       — funcoes puras, utilitarios
```

Alvo: e2e cobrindo os fluxos que geram receita ou bloqueiam o uso; tudo o
mais em componente. Um e2e de 40 segundos para testar uma validacao de campo
esta no nivel errado.

---

## Ferramentas deste projeto

<!-- Preencha na etapa 5 do bootstrap. -->

| Camada | Ferramenta | Arquivos | Comando |
| --- | --- | --- | --- |
| Unitario / componente | <!-- --> | <!-- --> | `make test` |
| E2E | <!-- --> | <!-- --> | `make e2e` |
| Cobertura | <!-- --> | — | `make test-coverage` |
| A11y estatica | <!-- plugin de lint --> | — | `make lint` |
| A11y em runtime | <!-- --> | — | `make perf` |

**Requisito tecnico:** `make test-coverage` precisa produzir
`coverage/lcov.info` — e o que o SonarCloud e o comentario de cobertura no
PR consomem.

---

## Testes de componente

### Consulte por papel acessivel, nao por classe CSS

Se o teste nao acha o botao pelo papel e pelo nome acessivel, o leitor de
tela tambem nao acha: o teste esta apontando um problema real, nao uma
inconveniencia.

Um seletor por classe ou por estrutura de DOM quebra em toda refatoracao de
estilo e nao quebra quando a acessibilidade regride — exatamente o inverso
do que voce quer.

`data-testid` e ultimo recurso, para elemento sem papel semantico.

### Simule interacao, nao evento

Prefira a API que reproduz a sequencia real (foco, keydown, input, change) a
disparar um evento sintetico isolado. Os bugs moram na sequencia.

### Regras

- Um comportamento por teste; o nome descreve o comportamento, nao a funcao
  chamada.
- Sem mock do que voce esta testando. Mock e para a **borda**: rede, tempo,
  armazenamento.
- Mocke a rede na fronteira da sua camada de API, nao no meio do cliente
  HTTP.
- Sem espera com timeout arbitrario: use a API que ja espera pela condicao.
- Teste que falha uma vez a cada dez execucoes e um teste quebrado.
  Conserte ou remova — nao adicione `retry`.

### Checklist por componente

- [ ] Renderiza com as entradas minimas
- [ ] Renderiza cada estado relevante (carregando, vazio, erro, sucesso)
- [ ] Interacoes chamam os callbacks com os argumentos certos
- [ ] Caso de borda: lista vazia, texto longo, valor nulo
- [ ] Acessivel: papel correto, rotulo, alcancavel por teclado

---

## Testes e2e

### O smoke test minimo

Todo projeto deve ter, desde o primeiro dia, um teste que prove que **a home
carrega**. Ele valida build, servidor e bootstrap de uma vez, e e o que pega
a classe de erro mais cara: o app que nem sobe.

Vale a pena cobrir junto, no mesmo smoke test:

- nenhum erro no console durante o carregamento;
- o skip link (ou o primeiro elemento focavel) funciona pelo teclado;
- nao ha rolagem horizontal em viewport de 320px.

### Regras

- Escreva pelo fluxo do usuario, nao pela estrutura de telas.
- Nada de espera por tempo fixo — use as assercoes com auto-wait da
  ferramenta.
- Cada teste cria o proprio dado e nao depende de ordem de execucao.
- Nenhum teste depende de dado que exista "so no ambiente X".
- Defina contra que ambiente a suite roda: preview local por padrao,
  ambiente publicado via `E2E_BASE_URL`.

### Fluxos criticos deste projeto

<!--
Criterio: se quebrar em producao, quanto custa? Se a resposta for "pouco",
nao e e2e.
-->

| Fluxo | Arquivo | Por que e critico |
| --- | --- | --- |
| A home carrega | <!-- --> | Se falha, tudo falha |
| <!-- --> | <!-- --> | <!-- --> |

---

## Cobertura

**Piso:** <!-- % --> — o CI falha abaixo disso.

Cobertura e piso, nao meta. 100% com assercoes fracas nao prova nada; 70%
com testes que descrevem comportamento real prova bastante.

Fora da conta, de proposito: ponto de entrada, codigo gerado, helpers de
teste, arquivos de configuracao.

Subir o piso: mude o valor, rode o CI, justifique no PR.
**Baixar:** exige aprovacao humana (`AGENTS.md` secao 6).

---

## Onde cada teste roda no CI

| Job | Alvo | Bloqueia merge |
| --- | --- | --- |
| `conventions` | Nome de branch e Conventional Commits | Sim |
| `quality` | `make format-check`, `make lint`, `make typecheck` | Sim |
| `unit-tests` | `make test-coverage` | Sim |
| `build` | `make build`, `make bundle-budget` | Sim |
| `e2e` | `make e2e` | Sim |
| `performance` | `make perf` | Sim |
| `sonarcloud` | Quality Gate | Sim |
| `analyze` (CodeQL) | SAST | Configuravel |

O resultado consolidado, com cobertura, vira comentario fixo no PR
(`.github/workflows/github-agent.yml`).

---

## Como debugar

```bash
make test-watch          # testes em watch
make e2e                 # suite e2e completa
make doctor              # confirma o que esta configurado
```

<!-- Acrescente os comandos especificos da ferramenta: rodar um arquivo so,
     modo UI, inspector, abrir o ultimo relatorio. -->

Falhou so no CI? Baixe o artefato `e2e-report` do run — ele tem screenshot,
video e trace do momento da falha.

---

## O que este projeto nao testa

<!--
Ser explicito aqui evita rediscutir a mesma coisa em todo code review.
Exemplos:
  - Regressao visual: nao usamos (avaliar se X)
  - Teste de carga: responsabilidade do time de backend
  - Matriz completa de browsers: so chromium no CI; demais antes do release
-->

- <!-- -->
