# AGENTS.md

> **Este arquivo pertence a um repositorio TEMPLATE.**
>
> Se voce esta lendo isto dentro de um projeto criado a partir do template
> — ou seja: o repositorio tem nome proprio, tem produto, tem gente usando —
> entao **este arquivo esta desatualizado por definicao** e reescreve-lo e a
> sua primeira tarefa.

---

## Para agentes de IA: leia isto antes de qualquer coisa

### Se este repositorio ainda E o template

Voce esta no `template-frontend`: a fundacao de qualidade, CI/CD e
documentacao que todo frontend recebe no primeiro commit.

Ele **nao tem stack**. Nao ha framework, nem ferramenta de teste, nem
plataforma de deploy escolhida — e isso e intencional, nao uma lacuna a
preencher. A fundacao conversa com a stack por um contrato de comandos
(`Makefile` + `project.mk`).

Regras aqui:

- **Nao adicione stack.** Nada de `package.json`, framework, biblioteca de
  teste ou plataforma de deploy. Se a mudanca amarra o template a uma
  tecnologia, ela nao pertence a este repositorio.
- **Nao adicione funcionalidade de produto.** Nenhuma tela, nenhum dominio.
- Mudancas validas: melhorar um workflow, melhorar um esqueleto de
  documentacao, corrigir um script de convencao, deixar uma regra mais clara,
  acrescentar uma receita a `DEPLOY.md` ou um exemplo a `project.mk`.
- Ao mexer aqui, pense no efeito em **todos** os projetos futuros.

### Se este repositorio FOI CRIADO a partir do template

**Antes de escrever qualquer codigo, conduza o bootstrap:**
[`BOOTSTRAP.md`](BOOTSTRAP.md) — ele traz as dez etapas de decisao (tipo de
aplicacao, stack, qualidade, testes, deploy, contrato de API...), o que
perguntar em cada uma e onde registrar a resposta.

Rode `make doctor` primeiro: ele mostra o que ja foi decidido e o que falta.

**A ultima etapa do bootstrap e reescrever este arquivo** com o conteudo real
do projeto, seguindo o modelo abaixo. Por que isso importa: este arquivo e o
contexto que todo agente le primeiro. Enquanto ele falar do template, cada
agente vai comecar com a premissa errada. E escreve-lo obriga o time a
decidir coisas que costumam ficar implicitas.

Como fazer: apague tudo acima da linha `<!-- INICIO DO MODELO -->`, preencha
o modelo, apague os comentarios de instrucao, e commite sozinho
(`docs: define AGENTS.md do projeto`).

Enquanto este arquivo nao for reescrito, um agente deve **avisar quem pediu a
tarefa** e oferecer a reescrita antes de seguir.

### Faxina do primeiro commit

| Arquivo | O que fazer |
| --- | --- |
| `AGENTS.md` | Reescrever (este arquivo) |
| `README.md` | Reescrever para o produto |
| `BOOTSTRAP.md` | Apagar depois de concluir as dez etapas |
| `SETUP-GITHUB.md` | Apagar depois de executar o checklist |
| `project.mk` | Preencher; remover os blocos de exemplo que nao usar |
| `.tool-versions` | Fixar a versao do runtime |
| `STACK.md`, `ARCHITECTURE.md`, `TESTING.md`, `DEPLOY.md` | Preencher os esqueletos |
| `.github/CODEOWNERS` | Trocar `@SUA-ORG/...` por times reais |
| `.github/ISSUE_TEMPLATE/config.yml` | Trocar as URLs |
| `sonar-project.properties` | Trocar organization e projectKey |
| `release-please-config.json` | Trocar `release-type` pelo da stack |
| `docker/*.example` | Copiar o que usar para a raiz; apagar o resto |
| `scripts/deploy.sh` | Implementar com a receita de `DEPLOY.md` |

**Nao remova:** `Makefile`, `.githooks/`, `scripts/conventions.sh` e os
validadores, os workflows, `CLAUDE.md`, `.editorconfig`, `.gitattributes`,
os arquivos do release-please.

---

<!-- INICIO DO MODELO — em um projeto real, tudo acima disto sai -->

## Estrutura obrigatoria do AGENTS.md do projeto

As sete secoes abaixo sao obrigatorias, nesta ordem. O conteudo entre
`<!-- -->` e instrucao de preenchimento e deve ser apagado.

---

### 1. Visao geral

<!--
Em ate 10 linhas, o que um dev novo (ou um agente sem contexto) precisa saber
antes de tocar em qualquer arquivo:
  - O que este produto faz e para quem.
  - O papel DESTE repositorio no sistema (quais backends consome, quem
    depende dele).
  - Em que estagio esta: prototipo, producao, legado em manutencao.
  - O que NAO esta aqui e as pessoas costumam procurar aqui.
Sem historia do projeto, sem lista de features. Contexto operacional.

Mantenha SEMPRE a linha do docs/shared abaixo (ou diga que nao ha):
-->

**docs/shared do projeto:** <!-- org/repo, ou "nao ha" -->. Antes de decisao de
arquitetura ou de contrato de API, leia o `ARCHITECTURE.md`, as ADRs
(`docs/adr/`) e o `GLOSSARY.md` de la — de preferencia clonado ao lado deste
repositorio (`../<nome-do-shared>`). Se nao estiver clonado, peca para clonar.
Tipos de API vem de la via `sync-api-types.yml`; nunca os escreva a mao.

**Fonte do design:** <!-- ferramenta e link (Claude Design, Figma, design system
da org), ou "nao ha" -->. Tela nova ou alterada e implementada A PARTIR do
design de referencia (link na issue), nao inventada. Valores visuais vem dos
tokens (`ARCHITECTURE.md` secao 5). Se o design e o codigo divergirem, pergunte
qual vale antes de escolher.

### 2. Comandos

Todos os comandos passam pelo contrato do `Makefile`. Os comandos reais de
cada alvo ficam em `project.mk` — e la que se troca de ferramenta.

| Comando | O que faz | Observacao |
| --- | --- | --- |
| `make setup` | Instala dependencias e ativa os hooks | Primeira coisa apos o clone |
| `make dev` | Sobe o servidor de desenvolvimento | <!-- porta --> |
| `make build` | Gera o artefato de producao | Saida em <!-- BUILD_DIR --> |
| `make preview` | Serve o build localmente | <!-- porta --> |
| `make lint` | Analise estatica (a11y + code smells) | `make lint-fix` corrige |
| `make format` | Formata | `make format-check` so verifica |
| `make typecheck` | Checagem de tipos | |
| `make test` | Testes unitarios / de componente | `make test-watch` em watch |
| `make test-coverage` | Testes com cobertura | Minimo <!-- % --> |
| `make e2e` | Testes end-to-end | |
| `make bundle-budget` | Orcamento de bundle | Falha se estourar |
| `make perf` | Core Web Vitals | |
| `make generate-types` | Gera tipos do contrato de API | |
| `make validate` | Formato + lint + tipos + testes | **Rode antes de abrir PR** |
| `make doctor` | O que esta configurado e o que falta | |
| `make help` | Lista os alvos | |

<!--
Ajuste a tabela: remova as linhas dos alvos marcados como `skip` em
project.mk e anote porta, diretorio de build e meta de cobertura reais.
-->

**Windows:** `make` nao vem instalado. Use WSL, ou
`winget install ezwinports.make`.

### 3. Convencoes

<!--
Regras que um agente deve seguir sem perguntar. Escreva as que o projeto
realmente segue; apague as que nao valerem. Prefira regra verificavel a
principio abstrato. Sugestoes do que cobrir:

**Estrutura** — onde ficam componentes, paginas, hooks, utilitarios;
  co-localizacao de teste e estilo; alias de import.
**Linguagem** — modo estrito? `any` proibido? padrao de nomenclatura?
**Rede** — toda chamada passa pela camada X; nada de fetch/axios solto.
  (Faca disso uma regra de LINT, nao um acordo verbal — acordo verbal nao
  sobrevive ao terceiro mes.)
**Tipos de API** — gerados do contrato, nunca escritos a mao.
**Estilo** — escopo por componente, tokens em vez de valores literais,
  mobile-first.
**Design** — onde ficam os tokens; como o design chega ao agente (link na
  issue, export em docs/design/); o que fazer com codigo exportado pela
  ferramenta de design (ARCHITECTURE.md secao 5).
**Acessibilidade** — semantica antes de ARIA, tudo alcancavel por teclado.
**Ambiente** — leitura de variavel de ambiente em um unico modulo, validada
  no boot; variavel nova documentada em .env.example.
-->

### 4. Regras de commit e PR

**Branches** — `feature/`, `fix/`, `hotfix/`, `release/`, `chore/`, `docs/`,
`refactor/` ou `test/` + slug em minusculas.
Ex.: `feature/filtro-por-data`.

**Commits** — [Conventional Commits](https://www.conventionalcommits.org):
`tipo(escopo): descricao no imperativo`.

```
feat(checkout): valida cupom antes de habilitar o botao
fix(http): trata timeout como erro recuperavel
feat(api)!: remove o campo legado de resposta
```

Tipos: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`,
`ci`, `chore`, `revert`.

As duas regras vivem em `scripts/conventions.sh` e sao aplicadas nos hooks de
git **e** no CI — local e pipeline nao podem divergir.

**Pull requests**

- Titulo tambem em Conventional Commits (vira a mensagem do squash merge).
- Preencha o template inteiro; nao apague secoes.
- Vincule a issue com `Closes #N`.
- PR pequeno. Refatoracao ampla vai separada da mudanca de comportamento.
- Merge so com `ci-success` verde e aprovacao de CODEOWNER.

### 5. Checklist de conclusao de tarefa

Uma tarefa **nao esta pronta** enquanto todos os itens abaixo nao forem
verdade. Rode os comandos; nao suponha o resultado.

- [ ] `make validate` passa
- [ ] `make e2e` passa quando a mudanca afeta fluxo de tela
- [ ] `make build` e `make bundle-budget` passam
- [ ] Teste novo cobrindo o comportamento adicionado ou o bug corrigido
- [ ] Nenhum log de depuracao, teste marcado como `only`/`skip`, ou supressao
      de tipo sem justificativa
- [ ] Variavel de ambiente nova documentada onde a secao 3 exige
- [ ] UI nova verificada no teclado e em viewport de 320px
- [ ] UI confere com o design de referencia, ou a divergencia esta explicada
      no PR (acessibilidade vence o design: contraste e teclado nao se negociam)
- [ ] Documentacao atualizada quando o comportamento ou a arquitetura mudou
- [ ] Mensagem de commit e nome de branch nos padroes da secao 4
- [ ] Descricao do PR explica **o que** e **por que**, com evidencia visual
      se mexeu na UI

Se algum item nao se aplica, diga na descricao do PR por que.

### 6. Pontos que exigem aprovacao humana

Um agente **para e pergunta** antes de fazer qualquer coisa desta lista.
Propor o diff e explicar o motivo esta liberado; aplicar sem confirmacao, nao.

- Adicionar, remover ou trocar dependencia
- Mudar `project.mk` de forma que altere o que o CI executa
- Mudar `.github/workflows/**`, permissao de token ou regra de deploy
- Mudar secret, variavel de ambiente ou configuracao de infraestrutura
- Rodar deploy para `homolog` ou `prod`
- Mudar o contrato de API consumido, ou editar codigo gerado a mao
- Mudar tokens de design (cor, tipografia, espacamento) fora de uma
  atualizacao vinda do design de referencia: afeta todas as telas
- Afrouxar regra de qualidade: desligar regra de lint, baixar o piso de
  cobertura, aumentar o orcamento de bundle, marcar um alvo como `skip`
- Migracao ampla (framework, build, gerenciador de pacotes, roteador)
- `git push --force`, reescrita de historico, mexer em branch protegida
- Apagar teste, ou marca-lo como `skip` para fazer o CI passar
- Qualquer coisa que envolva dado real de usuario

**Regra geral:** se o erro sai caro, sai em producao ou e dificil de
reverter, pergunte primeiro.

### 7. Armadilhas conhecidas

<!--
A secao mais util com o tempo. Registre o que ja fez alguem (ou algum agente)
perder uma tarde. Uma linha por armadilha. Exemplos do tipo de coisa:
  - "O endpoint X devolve 200 com corpo de erro; trate pelo campo `status`."
  - "O teste Y e flaky por causa de animacao; respeite prefers-reduced-motion."
  - "Nao rode `make generate-types` sem VPN: o contrato e interno."
Comece vazio e va preenchendo.
-->

- <!-- -->

---

## Como a fundacao funciona (referencia)

Util para um agente entender por que as coisas estao onde estao.

| Peca | Papel |
| --- | --- |
| `Makefile` | Contrato de comandos. Nao se edita. |
| `project.mk` | Os comandos reais. **O unico ponto de acoplamento com a stack.** |
| `scripts/conventions.sh` | Regras de branch e commit, compartilhadas por hooks e CI |
| `.githooks/` | Hooks versionados, sem dependencia de runtime |
| `scripts/deploy.sh` | O unico lugar que sabe para onde publicar |
| `.github/workflows/ci.yml` | Portao de merge (`ci-success`). Falha e bloqueia. |
| `.github/workflows/github-agent.yml` | Feedback: rotula, comenta, organiza. Nunca bloqueia. |
| `.github/workflows/release.yml` | Versao e CHANGELOG a partir dos commits (release-please) |
| `.github/workflows/sync-api-types.yml` | Regenera os tipos quando o contrato no docs/shared muda |
| `IgorOCosta/workflows` (`@v1`) | Onde mora a logica dos workflows acima e as regras centrais de convencao |
| `.tool-versions` | Versao do runtime, instalada pelo CI |
| `CLAUDE.md` | Uma linha (`@AGENTS.md`): o Claude Code carrega este arquivo |

**Um alvo `skip` em `project.mk` e uma decisao registrada**, revisitavel —
nao um esquecimento. `make doctor` mostra os tres estados (configurado,
`skip`, pendente).
