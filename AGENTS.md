# AGENTS.md

> Contexto para pessoas e agentes de IA. Leia antes de tocar em qualquer
> arquivo. Responda ao dono em portugues; o **codigo, os commits e as chaves de
> traducao sao em ingles** (ADR 0017). Portugues so aparece nos arquivos de
> traducao e nos documentos.

## 1. Visao geral

Frontend web do **pokemonAuction** (nome provisorio): SaaS B2B multi-tenant para
lojistas de cartas TCG fazerem leiloes em grupos de WhatsApp. Este repositorio
tem o app da loja, a area `/admin` da plataforma, as paginas publicas por token
(acerto do comprador, acompanhamento do consignador), a vitrine e a landing.
Consome a API do repositorio `Backend`. Produto novo indo para producao,
mantido por uma pessoa. Requisitos: WCAG AA, LGPD, idiomas `en` e `pt-BR`.

Nao esta aqui: API, banco, bot de WhatsApp (repos `Backend` e
`whatsapp_microservice`).

**docs/shared do projeto:** `Project-PKA/shared` (clonado em `../shared`).
Comece por `../shared/OWNER.md` (canal com o dono: se um item bloqueia a
tarefa, pare e avise). Antes de decisao de arquitetura ou de contrato, leia o
`ARCHITECTURE.md`, as ADRs (`docs/adr/`) e o `GLOSSARY.md` de la, e
`docs/produto.md` (escopo e regras). Tipos de API vem do contrato; nunca os
escreva a mao.

**Contrato:** gerado pelo Backend em `../Backend/docs/api/openapi.yaml`. A copia
em `shared/openapi.yaml` ainda e um stub (a publicacao depende do secret
`AUTOMATION_TOKEN`, A2); por isso `OPENAPI_SPEC` aponta para o Backend. Se
faltar algo na API, **nao mexa no Backend**: abra issue no repo `Backend`.

**Fonte do design:** Claude Design; prototipo em `design/` (41 telas) e
`design/design-system/` (tokens, componentes). Tela nova ou alterada e
implementada A PARTIR do design, nao inventada. Valores visuais vem dos tokens
(`ARCHITECTURE.md` secao 5). Se o design e o codigo divergirem, pergunte qual
vale. Divergencias ja conhecidas: `design/README.md`.

## 2. Comandos

O `Makefile` e o contrato; os comandos reais estao em `project.mk`. No Windows
o `make` nao existe: rode o equivalente npm/npx de `project.mk` (com Node 22 e
npm 10.9).

| Comando | Equivalente | Observacao |
| --- | --- | --- |
| `make setup` | `npm ci --no-audit --no-fund` | Primeira coisa apos o clone |
| `make dev` | `npm run dev` | http://localhost:3000 |
| `make build` | `npm run generate` | Saida estatica em `.output/public` |
| `make preview` | `npm run preview -- --port 4173 --strictPort` | Serve o build |
| `make lint` | `npx eslint . --max-warnings=0` | `make lint-fix` corrige |
| `make format` | `npx prettier --write .` | `make format-check` so verifica |
| `make typecheck` | `npx nuxt typecheck` | |
| `make test` | `npx vitest run` | `make test-watch` em watch |
| `make test-coverage` | `npx vitest run --coverage` | Piso 70% global, 85% em `app/api/**` |
| `make e2e` | `npx playwright test` | Precisa do build; `E2E_INSTALL_CMD` instala o Chromium |
| `make bundle-budget` | `node scripts/bundle-budget.mjs` | Apos o build; limites em `bundle-budget.json` |
| `make perf` | `npx lhci autorun` | Apos o build |
| `make generate-types` | `npx openapi-typescript $OPENAPI_SPEC -o app/api/generated.ts` | |
| `make validate` | formato, lint, tipos, testes | **Rode antes de abrir PR** |
| `make doctor` | | O que esta configurado e o que falta |

**Windows:** `make` nao vem instalado (`winget install ezwinports.make`, ou
WSL). O Node local pode ser o 20: use um Node 22 isolado (`npm i node@22` numa
pasta temporaria, prefixando o `PATH`) e `npm@10.9.9`.

## 3. Convencoes

**Estrutura** — codigo em `app/` (Nuxt 4); texto visivel so em
`i18n/locales/*.json`; testes ao lado do codigo (`*.test.ts`), e2e em `e2e/`.

**Linguagem** — TypeScript estrito. `any` so com justificativa.

**Rede** — toda chamada passa por `app/api/`. Regra de lint proibe `fetch`,
`$fetch` e `useFetch` fora dessa pasta. Erros viram `ApiError`.

**Tipos de API** — gerados em `app/api/generated.ts`; nunca editar a mao.

**Erros da API** — RFC 9457 com `code` estavel. Traduza pelo `code`; **nunca
mostre o `detail`** (vem em portugues do Backend). Todo `code` do contrato
precisa de traducao em `errors.<CODE>` em `en` e `pt-BR`: o catalogo copiado do
Backend esta em `app/api/error-codes.json` e `app/utils/translations.test.ts` falha
se faltar chave, sobrar chave, as duas linguas divergirem ou houver linguagem de
garantia. Quando o Backend ganhar codigo novo: `npm run sync:error-codes`, traduza
e rode os testes (`node scripts/sync-error-codes.mjs --check` diz se esta defasado).

**Localizacao** — `en` e `pt-BR`; idioma inicial pelo navegador, troca manual,
preferencia em `GET/PATCH /v1/me/preferences` (store `preferences`). Formate com
`useFormat()` (dinheiro como string, fuso do perfil), nunca montando texto a mao. Data, hora, numero e moeda com
`Intl` na localidade ativa. URLs sempre em ingles.

**Dinheiro e datas** — dinheiro chega como string decimal (`"25.50"`): nunca
converta para `number`. Datas em UTC na API, exibidas no fuso do usuario.

**Listas** — paginacao por cursor (`cursor`, `limit`, `next_cursor`). A Home e
"ao vivo" (polling por componente, sem periodo); so o Financeiro tem periodo.

**Autenticacao** — access token so em memoria (Pinia); refresh em cookie
httpOnly (`credentials: 'include'` so nas chamadas de auth); `401` tenta um
refresh. Rotas de loja levam `Authorization` e `x-store-id`. `403` com
`MISSING_PERMISSION` ou `OWNER_REQUIRED` mostra o estado de sem permissao.
Esconda ou desabilite pela permissao, mas a verdade e o servidor.

**Paginas publicas** — o token vai no **fragmento** da URL (`#token=`), nunca em
path ou query, e segue no corpo do POST. Link invalido, expirado, revogado,
bloqueado ou chave errada respondem o mesmo `404` (`PUBLIC_LINK_NOT_FOUND`):
uma unica mensagem generica. `noindex` e `Referrer-Policy: no-referrer`.

**Produto** — nao existe cadastro aberto (botao e "Solicitar acesso", nunca
"Criar conta"; campo-isca `website` vai vazio). Linguagem de garantia e
proibida em qualquer tela ou e-mail ("anti-calote", "compra segura"). Nao cite
a marca do catalogo na interface (licenca pendente).

**Estilo** — CSS global do design-system (classes BEM), sem Tailwind; sem cor
literal fora dos tokens; sem emoji como icone; fontes autohospedadas
(Fontsource), nunca do Google. `app/assets/css/tokens.css`, `components.css` e
`public/icons.svg` sao **copias identicas** de `design/design-system/`: so mudam
quando o design muda (copie, nao edite) e ficam fora do Prettier. O que e do projeto
vai em `app.css` (so tokens). `app/assets/css/design.test.ts` falha se uma copia
divergir ou se aparecer cor literal (`#hex`, `rgb()`, `hsl()`) em `.css`, `<style>`
ou `style=""` do projeto. Tema: `data-theme` no `<html>` (`SYSTEM` = sem atributo).

**Componentes** — use `AppButton`, `AppBadge`, `AppCard`, `AppInput`, `AppSelect`,
`AppTextarea` e `AppOtpInput` (`app/components/`) em vez de repetir as classes do design.
Sao apresentacionais: recebem textos ja traduzidos por props e slots (nao chamam
`useI18n` nem stores), e por isso sao testados com Testing Library. Campo de
formulario liga rotulo, dica e erro por id (`fieldIds`) e marca `aria-invalid`.
Botao so com icone exige `label`. O erro de campo vem do VeeValidate (chave de
traducao, traduzida na pagina) ou do servidor (por `code`).

**Paginas abertas** — convite, solicitar acesso e as paginas publicas por token usam
`usePublicApi()` (sem sessao, sem renovar). "Solicitar acesso" (`/request-access`) manda
o `website` (isca da API) **sempre vazio**; o campo existe no formulario, `inert` e fora
de vista, e um pedido com a isca preenchida nem e enviado. A resposta da API e igual para
pedido novo, repetido ou descartado: a tela nao diz se ja existia. Telefone brasileiro:
`maskBrazilPhone` (`app/utils/phone.ts`).

**Convite** — `/invite#token=...` le o token do fragmento com `tokenFromFragment`
(`app/utils/fragment-token.ts`, o mesmo para as paginas publicas por token) e o envia no
corpo do POST, sem sessao (`anonymous: true`). Token ausente, invalido, expirado ou
revogado mostram a mesma mensagem generica (a API responde o mesmo 404). Aceitar pede o
codigo de login e leva a `/login` ja no passo do codigo: o e-mail viaja na memoria
(`session.setLoginHint`), nunca na URL. `/convite` (link antigo do e-mail do Backend)
redireciona para `/invite` mantendo o fragmento ate o Backend#89 sair.

**Lojas** — `/stores` (carrossel `StoreDeck` e `StoreCard`) e `/stores/new` usam o layout
`public` (com "Sair" para quem esta logado). Clique do ponteiro num cartao fora do meio
so o traz para o meio (como no design); Enter escolhe na hora. Escolher chama
`access.selectStore` e o link leva a `/home`, onde o middleware carrega papel e permissoes.
"Criar nova loja" so aparece com `can_create_stores` e lojas proprias abaixo de
`store_limit` (`canCreateStore`); a API confere de novo. A API so recebe o nome; cidade,
QR do WhatsApp e grupo dependem do Backend (Backend#100) e a tela os mostra como "depois
de criar". 403 com codigo de uma acao (ex.: `CANNOT_CREATE_STORES`) nao manda a pessoa de
volta a `/stores` (`forbiddenAction` devolve `none`): a tela mostra a mensagem.

**Busca no catalogo** — `CatalogSearch` e um combobox (padrao WAI-ARIA "list autocomplete":
o foco fica no campo, `aria-activedescendant` aponta a sugestao, setas, Home/End, Enter e Esc;
um segundo Esc limpa o texto) e so mostra o que recebe; `useCatalogSearch` pergunta a API
(`/v1/catalog/search`) com 2 caracteres ou mais, 250 ms depois da ultima tecla, e mantem a
lista anterior ate a proxima chegar. A arte vem do endereco de origem que o catalogo da (D5
decidida em 18/10: texto, numero e arte por endereco de origem; a **marca** continua fora da
interface, diga "catalogo de cartas"): so `https` (`artUrl`), com `referrerpolicy="no-referrer"`.
O cadastro inteiro vive em `/inventory/new` (tela unica, issue #28). `AppCombobox` e o combobox
generico (slot `option`); `CatalogSearch` e `CustomerSearch` so dizem como cada item aparece, e
`useAsYouType` e a consulta (a chave inclui a loja).
Em teste de componente, importe `AppButton` e afins no `.vue` (o auto-import e do Nuxt).
**Estoque** — `/inventory` (lista) e `/inventory/:id` (carta), so com `can_manage_inventory`.
Os filtros (busca `q`, `status`, `origin`) ficam no endereco (`/inventory?status=SOLD`;
`parseFilters` descarta valor que a API nao conhece) e a busca espera 300 ms. Sem o filtro de
idioma do design: a API nao filtra por idioma e filtrar so a pagina carregada enganaria
(Backend#107). O `#ID` e um botao que copia (`AppIdChip`); a linha **nao** e clicavel, o
link esta no nome da carta. A foto real exige login, entao baixa como arquivo pelo cliente
(`request(..., { parse: 'blob' })`, `CardPhoto`) e o endereco temporario e liberado ao sair.
Sem imagem do catalogo (licenca, D5). Excluir exige `can_delete` **e** carta disponivel que
nunca foi a leilao; a tela explica o motivo quando o botao esta desabilitado e a API
(`CARD_HAS_HISTORY`, `CARD_NOT_AVAILABLE`) confere de novo. O detalhe da API vem como
`{ card, auctions }`. Cadastrar e editar sao das issues #27 e #28.
**Home** — `/home` e ao vivo e **so os componentes atualizam, nunca a pagina**: a pagina so
organiza `HomeSetup`, `HomePollAlert`, `HomeKpis`, `HomeNoAuction` e `HomeSettlements`, e cada
um chama `useHomeData(select)` (TanStack Query, 15 s enquanto a aba esta visivel). Todos usam a
mesma chave, entao a API (`/v1/dashboard/home`) e chamada uma vez por rodada, e como o `select`
mantem a identidade quando o conteudo nao mudou, so o componente cujo dado mudou e tocado. O
erro de carga aparece so em `HomeKpis` (os outros calam). Sem periodo e sem ranking. O "ha 12 minutos" conta
a partir do momento em que o dado chegou (`useFormat().relative`). O contrato nao marca como
obrigatorios os campos de dentro das listas, entao `app/utils/home.ts` normaliza as linhas
(sem `id` a linha sai; texto ausente vira vazio) e o valor segue como a string que a API
mandou. A lista de passos da loja nova (`setupSteps`) some quando os quatro estao feitos.
Links so para telas de menu (`/settings`, `/inventory/new`, `/auctions`, `/customers/:id`),
e so para quem tem a permissao. Fica de fora o que o design tem e a API nao da: selo de
"proximo leilao as 14:30" e "ultimo lance ha 8 s", origem e "parada ha" das cartas, o
alerta de WhatsApp caido (issue #32) e a aprovacao da enquete (issue #31).
**Notificacoes e atividade** — `/activity` (o sino da barra do topo, que mostra o numero de
nao lidas via `useUnreadCount`, a cada 60 s). A API manda so `kind`/`action` e ids: o texto
e nosso (`app/utils/activity.ts` lista os codigos conhecidos; um codigo novo cai no texto
generico e `activity.test.ts` falha se faltar traducao de um conhecido). O log e do
proprietario (a aba nem aparece para staff). Quem fez vem da equipe (`/v1/team`); quem saiu
aparece como "Ex-integrante". Sem os filtros do design (usuario e acao): a API nao filtra e
filtrar so a pagina carregada enganaria (Backend#106). Linhas sem link ate as telas de
destino existirem.
**Perfil** — `/profile` (link do rodape do menu) usa so o que a API tem: preferencias
(`preferences.saveProfile` manda so o que mudou; idioma e tema valem na hora, como na barra
do topo), notificacoes (`in_app` e `email`; o design tinha tres avisos por tipo) e sessoes
(`authApi.listSessions` e `revokeSession`; a atual nao tem botao de encerrar). Nome, e-mail,
telefone, CPF, data de nascimento e endereco **nao tem endpoint** de edicao (Backend#105):
a tela mostra nome e e-mail desabilitados e o selo "Edicao em breve". Nao invente campo
nem botao ate a API existir; "Sair de todos os aparelhos" e foto tambem ficam de fora.
`describeUserAgent` resume o aparelho ("Chrome, Windows") e `timeZoneOptions` lista os
fusos sem perder o salvo.

**Cadastro de carta** — o formulario so aparece depois de escolher a carta no catalogo. A
**origem nao tem valor inicial** e "Salvar" fica desabilitado ate escolher (a condicao tambem
nao e adivinhada; o idioma comeca em PT, como o design). Consignada pede o cliente (busca por
nome, telefone ou CPF) e a comissao (0 a 100, aceita virgula; comeca em 15, como o design).
Ordem do envio: `POST /v1/cards`, depois uma foto por vez (`PUT /v1/cards/:id/photos`, o corpo
e a imagem; `request` manda `Blob` como esta), depois, se consignada, o link do consignador
(`POST /v1/customers/:id/consignor-link`). A carta **nao** e criada de novo se uma foto ou o
link falhar: a tela diz o que nao foi e segue (`Saved`). O token do link aparece **uma vez** e
vai no fragmento (`consignorLinkUrl`, `/consignor#token=`); "Enviar no WhatsApp" abre
`wa.me` com o telefone do cliente (`rel="noopener noreferrer"`). Sem a secao "Leilao" do design:
agendar e da #29 (a carta fica "Disponivel"). Foto depois do cadastro ainda nao tem tela.

**Leiloes** — `/auctions` (abas Em andamento, Agendados, Encerrados e Cancelados; cada uma pede
so o seu `status` por cursor, e a API nao da contagem, entao as abas nao mostram numero) e
`/auctions/:id/edit`; so com `can_manage_auctions`. Os que esperam validacao do teto
(`PAUSED_FOR_VALIDATION`) aparecem primeiro em "Em andamento" (e o proprio leilao ao vivo e
da #30). "Novo leilao" e um modal (`AuctionCreate`; `/auctions/new`, que a Home usa, so
redireciona para `/auctions?new=1`): uma carta **disponivel** (busca por #ID ou nome), "Agendar"
(inicio e fim) ou "Lancar agora" (sem `start_time`, so o fim) e os termos (`AuctionTerms`, o
mesmo na edicao). **Data**: o campo `datetime-local` e lido no **fuso do perfil**, nao no do
navegador (`localInputToUtc` / `utcToLocalInput`). **Dinheiro**: o valor digitado ("25,50") so
vira o texto decimal que a API quer (`normalizeMoney`); a comparacao do teto usa centavos
inteiros, nunca `number` de ponto flutuante. Regras como a API: fim depois do inicio e no
futuro, lance e incremento acima de zero, teto so na enquete e acima do lance. Edicao: leilao
agendado muda tudo; **em andamento so o fim** (a API devolve `AUCTION_LOCKED` no resto); ja
encerrado ou cancelado e so leitura. A tela manda so o que mudou (`toUpdateBody`). Cancelar
(modal de confirmacao) vale ate encerrar. "Deixar para depois" do design nao e um leilao: e
cadastrar a carta sem agendar.

**Sala do leilao** — `/auctions/:id` e um monitor: uma consulta (`GET /v1/auctions/:id`, leilao e
lances, o maior primeiro) que repete a cada **5 s** enquanto esta em andamento ou aguardando
validacao, a cada 15 s se agendado (para notar quando comeca) e **para** quando termina. A
contagem regressiva e do relogio da tela (`useNow`, `formatCountdown`), nao da API, e o
`role="timer"` tem `aria-live="off"` (anunciar todo segundo seria ruido). A foto real e a
origem vem da carta (`GET /v1/cards/:id`). "Estender" (+15, +30, +1 h) chama
`POST /v1/auctions/:id/extend` e so aparece em leilao rodando. O telefone do lance vem
mascarado da API; o do vencedor sai do lance dele. O vencedor leva a `/customers/:id` (#33).
Aprovar o encerramento ou manter aberto a enquete que bateu no teto e da #31.

**Enquete no teto** — `/auctions/polls` lista os leiloes `PAUSED_FOR_VALIDATION` (a Home e a
lista de leiloes levam para la; atualiza a cada 15 s). Cada `PollCard` mostra o valor maximo, o
maior lance, o vencedor provisorio (link para `/customers/:id`) e os ultimos lances, e
`PollDecision` (tambem usado na sala do leilao) decide: **Manter aberto** vale na hora;
**Aprovar encerramento** pede confirmacao, porque anuncia o vencedor no grupo (ADR 0004).
Depois de decidir, `auctions`, `auction`, `home` e `inventory` sao invalidados (a carta muda de
estado). `/auctions/polls` e rota fixa: vem antes de `/auctions/:id`.

**WhatsApp caiu** — `useAffectedAuctions` (`GET /v1/auctions/affected`, a cada 15 s, sem
retentar) responde duas coisas: o estado do WhatsApp da loja e os leiloes em andamento que ele
afeta (vazio quando ONLINE). A Home mostra o alerta vermelho (`HomeWhatsapp`, so quando nao
esta ONLINE) com a quantidade e "Reconectar agora"; `/whatsapp` tem os passos para
reconectar e a tabela dos afetados com "+30 min" por linha e "Estender todos"
(`POST /v1/auctions/extend`), mais o aviso de que lances da queda podem nao ter sido
registrados. **O QR code nao aparece**: a API nao o entrega (Backend#100); a tela diz isso.
Os textos ficam em `waDown.*` (a chave `whatsapp.*` e dos estados do chip).

**Clientes** — `/customers` (lista), `/customers/:id` (perfil) e `/customers/blacklist`, so com
`can_manage_customers`. Os filtros (`q`, `type`) ficam no endereco; "Consignador" nao e um
`kind` da API (so `VISITOR` e `CUSTOMER`), e sim o filtro `consignor=true` (`toApiFilters`).
Visitante = cadastro incompleto (CPF e endereco faltam). **O CPF e so de escrita**: a API devolve
so o mascarado, entao o campo comeca vazio e so vai no `PATCH` se alguem digitou um (as
mascaras de CPF e CEP estao em `utils/documents.ts`). `toChanges` manda so o que mudou; o
endereco vai inteiro (campos vazios como `null`) assim que um muda. O telefone nao muda: e a
identidade no grupo, guardado como digitos com o pais (`formatStoredPhone` / `toStoredPhone`).
Sem a coluna "Compras", o "Consignador" na linha, o bairro e o "desde" da blacklist: a API
nao da (Backend#108). Blacklist: adicionar um numero cria o cliente como visitante se ainda
nao existir (`CUSTOMER_PHONE_TAKEN` faz achar o que ja existe pelo telefone) e depois bloqueia;
o modal avisa que o numero sai do grupo. Inatividade: `PATCH /v1/store` com
`inactivity_days_limit` (so o proprietario; um 403 leva a tela de sem permissao, como
sempre) e `GET /v1/customers?inactive=true` (a expulsao e a ultima interacao + os dias). Um
`<input type="number">` entrega `number`, nao texto: leia com `String()`. Confirmar pagamento e da #35.

**Carteira de consignacao** — terceira aba de `/customers/:id` (`ConsignmentWallet`), so com
`can_view_finance` (a API exige: sem a permissao nao ha aba, para nao cair na tela de sem
permissao). Os totais (`in_stock`, `pending_net`, `sold_net`, `commission`) vem da API a cada
pagina, e sao estimativas ate o acerto; a linha mostra a comissao como `− R$` e `—` para o que
ainda nao vendeu. O link do consignador (`POST /v1/customers/:id/consignor-link`) aparece **uma
vez**, com o token no fragmento; exige CPF cadastrado (os 4 primeiros digitos sao a chave) e cada
clique cria um link novo. Nao ha como listar ou revogar os links ja criados de um cliente: a API nao
filtra por `customer_id` (Backend#108).

**Envios** — `/shipments` (item "Envios" do menu, com `can_manage_auctions`): a fila das vendas
pagas (`GET /v1/shipments`, por cursor), com o filtro de status no endereco
(`/shipments?status=SHIPPED`; `parseShipmentStatus` descarta valor desconhecido). A linha "A enviar"
tem o campo de rastreio e "Marcar como enviado" (`PATCH /v1/shipments/:id`; o codigo vai junto so se
foi digitado, `toShippedChanges`); a "Enviado" tem "Avisar cliente no WhatsApp" (link `wa.me`, a decisao
D7: a API **nao manda mensagem** por conta propria, ADR 0006) e "Marcar como entregue" (o design nao
tem esse botao, mas a API tem o estado). Sem a coluna "Cartas" e sem a busca do design: a API da fila
nao devolve as cartas da venda nem filtra por texto (Backend#109). Confirmar o pagamento e sempre da loja: na aba "Acertos" de `/customers/:id`, o acerto pendente tem
"Confirmar pagamento" (so com `can_view_finance`; modal de confirmacao, porque as cartas passam a
vendidas; `POST /v1/settlements/:id/paid`). O aviso do comprador nao basta. Ainda falta o resumo do
acerto para copiar e a criacao do acerto (`POST /v1/settlements`).

**Shell** — pagina do app usa `layout: 'app'` (menu lateral, barra do topo) e declara
`definePageMeta({ i18n: false, layout: 'app', titleKey: 'nav.x', access: { ... } })`: o
layout mostra `titleKey` como o unico `h1` da pagina (nao ponha outro `h1` no conteudo).
O menu vem de `NAV_ITEMS` (`app/utils/navigation.ts`) com a mesma regra de acesso da
pagina; item novo de menu = item novo la, e a rota precisa de `ssr: false` no
`nuxt.config.ts`. Menu: desktop completo, tablet (901 a 1100px) em trilho so com icones
(por isso todo link tem `aria-label`), celular (ate 900px) em gaveta com `aria-expanded`,
foco no primeiro item, Esc, clique fora e `inert` no resto. Erros (404, 403) aparecem
dentro do shell para quem esta numa loja.

**Dados e feedback** — lista de tela: `useCursorList` (`app/utils/cursor-list.ts`, sobre o
TanStack Query; junta as paginas por `next_cursor`) com `AppDataState` para os estados de
carregando, vazio e erro, e `AppTable` (legenda obrigatoria, `data-label` para o layout
de cartoes no celular). Linha de tabela **nao** e clicavel: ponha um link na celula
(`#cell-<coluna>`). A chave da consulta inclui tudo de que a lista depende; o cache e
esvaziado ao sair e ao trocar de loja. Leitura repete ate 2 vezes em falha de rede ou
5xx, nunca em 4xx (`shouldRetry`). Mensagem curta apos uma acao: `useToast()`
(`success`, `info`, `warning`, `error`); erro fica ate ser dispensado e vai numa regiao
`role="alert"`, o resto some em 6 s e pausa com mouse ou foco. Modal: `AppModal` sobre
o `<dialog>` nativo (foco preso, Esc, foco devolvido); Esc e fundo so pedem para fechar,
quem decide e a pagina. Abas: `AppTabs` (padrao WAI-ARIA, setas, Home, End).

**Acessibilidade** — semantica antes de ARIA, tudo por teclado, contraste AA,
responsivo (desktop, tablet ate 1100px, mobile ate 640px), tema claro, escuro
e sistema.

**Seguranca** — nada de segredo ou token em codigo, log, issue ou chat; nada de
dado pessoal real nos testes (`@example.com`, CPFs ficticios); CSP restritiva;
sem `innerHTML` com dado externo.

**Ambiente** — variavel de ambiente lida em um unico modulo e documentada em
`.env.example`. Resolvidas em **build** (`SITE_URL` etc.).

## 4. Regras de commit e PR

**Branches** — `feature/`, `fix/`, `hotfix/`, `release/`, `chore/`, `docs/`,
`refactor/` ou `test/` + slug em minusculas.
Ex.: `feature/store-selection`.

**Commits** — [Conventional Commits](https://www.conventionalcommits.org), em
ingles: `tipo(escopo): descricao no imperativo`.

```
feat(auth): add OTP login form
fix(api): treat timeout as a recoverable error
```

Tipos: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`,
`ci`, `chore`, `revert`. As regras vivem em `scripts/conventions.sh` e valem
nos hooks e no CI.

**Pull requests** — titulo tambem em Conventional Commits; template inteiro
preenchido; `Closes #N`; PR pequeno e **em rascunho** ate o `ci-success` ficar
verde. Uma issue por entrega, em sprints (milestones) como em
`../shared/docs/processo.md`. Merge so com `ci-success` verde e e do dono: o
agente **nao faz merge**.

## 5. Checklist de conclusao de tarefa

Rode os comandos; nao suponha o resultado.

- [ ] `make validate` passa (formato, lint, tipos, testes)
- [ ] `make e2e` passa quando a mudanca afeta fluxo de tela
- [ ] `make build` e `make bundle-budget` passam
- [ ] Teste novo cobrindo o comportamento adicionado ou o bug corrigido
- [ ] Nenhum log de depuracao, teste `only`/`skip`, ou supressao de tipo sem
      justificativa
- [ ] Texto visivel nos dois idiomas; `code` de erro novo traduzido
- [ ] Variavel de ambiente nova em `.env.example`
- [ ] UI nova verificada no teclado e em viewport de 320px
- [ ] UI confere com o design, ou a divergencia esta explicada no PR
      (acessibilidade vence o design)
- [ ] Documentacao atualizada quando o comportamento ou a arquitetura mudou
- [ ] Mensagem de commit e nome de branch nos padroes da secao 4
- [ ] PR explica **o que** e **por que**, com evidencia visual se mexeu na UI

## 6. Pontos que exigem aprovacao humana

Pare e pergunte antes de:

- Adicionar, remover ou trocar dependencia (diga o motivo e a alternativa)
- Mudar `project.mk` de forma que altere o que o CI executa
- Mudar `.github/workflows/**`, permissao de token ou regra de deploy
- Criar secrets, mexer em protecao de branch ou Environments (sao do dono)
- Rodar deploy para `homolog` ou `prod`
- Mudar o contrato de API consumido, ou editar codigo gerado a mao
- Mudar tokens de design fora de uma atualizacao vinda do design
- Afrouxar regra de qualidade: desligar regra de lint, baixar o piso de
  cobertura, aumentar o orcamento de bundle, marcar um alvo como `skip`
- Migracao ampla (framework, build, gerenciador de pacotes, roteador)
- `git push --force`, reescrita de historico, `push` na branch padrao
- Apagar teste, ou marca-lo como `skip` para o CI passar
- Qualquer coisa com dado real de usuario
- Implementar o que depende de decisao do dono em `../shared/OWNER.md`:
  comprovante em arquivo, cobranca e faturas, licenca das imagens da vitrine,
  nome do produto

## 7. Armadilhas conhecidas

- `npm` 10.9.9 quebra ao resolver peers do Nuxt (`Cannot read properties of
  null (reading 'edgesOut')`). Por isso `.npmrc` tem `legacy-peer-deps=true`;
  peers que o projeto usa sao instalados explicitamente. Rever quando o npm
  corrigir ou se migrarmos para o npm 11.
- `typescript` fica em `~5.9`: o TypeScript 7 nao e suportado pelo `vue-tsc`
  nem pelo `openapi-typescript` (peer `^5`).
- `nuxt preview` nao serve o build estatico (`.output/server` nao existe) e o
  `vite preview` devolve a landing para `/login`. O `preview` usa
  `scripts/serve-static.mjs`, que imita o proxy: arquivo, `<caminho>/index.html`,
  depois o fallback `200.html`. O proxy de producao precisa da mesma regra
  (`try_files $uri $uri/index.html /200.html`).
- `vee-validate` 4.15 nao aceita Zod 4 (o `@vee-validate/zod` e para Zod 3).
  `app/utils/zod-schema.ts` e o adaptador proprio; mensagens dos schemas sao
  chaves de traducao.
- Pagina nova protegida: declare `definePageMeta({ access: ... })` **e** inclua a
  rota em `routeRules` com `ssr: false`; sem isso o prerender a renderiza sem
  sessao. O botao "Pedir acesso ao proprietario" do design nao existe: a API
  nao tem o endpoint (Backend#94).
- `useForm` do VeeValidate com `defineField` deixa o campo `undefined`, e o Zod acusa o
  tipo com texto proprio (nao a chave de traducao): passe `initialValues` com `''`.
- O `offsetLeft` de um cartao do carrossel e relativo ao ancestral posicionado, nao ao
  `.deck`: o `StoreDeck` mede com `getBoundingClientRect`. O `.center-page` do design nao
  limita a coluna e o carrossel alargava a pagina: `app.css` usa `minmax(0, 1fr)`.
- O handler de clique do `RouterLink` roda antes do seu e ja chama `preventDefault`:
  nao use `event.defaultPrevented` para saber se outro codigo cancelou o clique.
- Em e2e, `locator.click()` rola o elemento para o meio do carrossel antes de clicar; para
  testar o clique em cartao fora do meio use `page.mouse.click` nas coordenadas.
- O orcamento de bundle mede o JS de entrada (o que a landing carrega) e o maior chunk de
  rota, nao a soma do build: tela nova pesa no seu proprio chunk. Se estourar o chunk de
  uma rota, divida a tela ou adie o que ela importa (`defineAsyncComponent`); subir o limite
  exige aprovacao. Dependencia usada por todas as telas entra na entrada (plugin do Nuxt):
  pese antes de registrar plugin global.
- A pagina sempre tem uma regiao `role="alert"` vazia (toasts de erro): em teste e2e escolha
  o alerta pelo texto (`getByRole('alert').filter({ hasText })`), nao so pelo papel.
- `.tabs` do design tem 1px de sobra e mostrava barra de rolagem; `app.css` corrige com
  `overflow-y: hidden`.
- O `<dialog>` modal nao trava a rolagem da pagina: `app.css` faz isso com
  `body:has(dialog[open])`.
- O `happy-dom` do Vitest nao prende o foco nem trata Esc no `<dialog>` (isso e do
  navegador): os testes de unidade cobrem so a nossa ligacao; foco preso e Esc foram
  conferidos no Chromium e entram no e2e na primeira tela que usar `AppModal`.
- O `lighthouserc.json` mede a landing e o `/login` (3 execucoes, vale a mediana: uma so
  oscilava acima do teto). O `/login` nao entra no SEO (tem `noindex`) e tem teto de LCP
  maior (3,5 s). Ele e pre-renderizado (o titulo e o formulario pintam do HTML; como
  SPA o LCP passava de 3,3 s) e a pagina so liga o comportamento no `onMounted`, entao a
  hidratacao e segura. Pagina pre-renderizada que linka para rota que ainda nao existe
  quebra o build: liste-a em `nitro.prerender.ignore`.
  A URL do Lighthouse precisa ser a rota (`/login/`), nao o arquivo (`/login/index.html`):
  este ultimo cai no 404 do app.
- `error.vue` substitui o app inteiro: precisa chamar `useAppHead()` (senao o `<html>` fica
  sem `lang`).
- Pagina do app (sem idioma na URL) declara `definePageMeta({ i18n: false })`; sem isso o
  modulo cria tambem `/pt-BR/...` e o prerender renderiza essa copia.
- O catalogo de codigos de erro vem de `Backend/docs/api/error-codes.json` (no `main`).
  Se o Backend estiver em outra branch com codigos novos, `--check` acusa defasagem: sincronize
  so a partir de codigo ja mergeado.
- `shared/openapi.yaml` e um stub de 78 linhas. O contrato real e o do Backend.
- O Backend envia o link de convite como `/convite#token=...`. O frontend usa
  `/invite` e mantem `/convite` como redirecionamento ate o Backend mudar
  (Backend#89).
- O `Response` do `fetch` so le o corpo uma vez: em testes use
  `mockImplementation(() => Promise.resolve(new Response(...)))`, nao
  `mockResolvedValue` reaproveitado.
- Nunca regrave arquivos de texto com `Set-Content` do PowerShell 5 (BOM). Em
  Bash, heredoc com aspas as vezes quebra: escreva scripts em arquivo.
- Pare containers e servidores que subir para teste ao terminar.
- `app/api/generated.ts` e gerado (13 mil linhas): fora do lint, do Prettier e
  da cobertura.

---

## Como a fundacao funciona (referencia)

| Peca | Papel |
| --- | --- |
| `Makefile` | Contrato de comandos. Nao se edita. |
| `project.mk` | Os comandos reais. **O unico ponto de acoplamento com a stack.** |
| `scripts/conventions.sh` | Regras de branch e commit, compartilhadas por hooks e CI |
| `.githooks/` | Hooks versionados, sem dependencia de runtime |
| `scripts/deploy.sh` | O unico lugar que sabe para onde publicar (pendente: A7) |
| `.github/workflows/ci.yml` | Portao de merge (`ci-success`) |
| `.github/workflows/github-agent.yml` | Feedback: rotula, comenta, organiza. Nunca bloqueia |
| `.github/workflows/release.yml` | Versao e CHANGELOG a partir dos commits (release-please) |
| `.github/workflows/sync-api-types.yml` | Regenera os tipos quando o contrato no shared muda |
| `IgorOCosta/workflows` (`@v1`) | Logica dos workflows e regras centrais de convencao |
| `.tool-versions` | Versao do runtime, instalada pelo CI |
| `CLAUDE.md` | Uma linha (`@AGENTS.md`) |

Um alvo `skip` em `project.mk` e uma decisao registrada e revisavel.
