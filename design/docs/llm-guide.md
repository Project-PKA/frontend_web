# Guia para LLMs

Leia isto antes de criar ou editar qualquer tela. É curto de propósito.

## 1. Contexto do produto

Painel web para **lojistas de cartas Pokémon TCG** que fazem **leilões em grupos de WhatsApp**. Um bot posta a carta no grupo, registra os lances e anuncia o vencedor. O painel cuida de estoque, agenda de leilões, acertos, consignados, envios, equipe e dashboards. Existe também uma **vitrine pública** de leilões ao vivo e uma área **/admin** para quem opera a plataforma.

Quem usa: o lojista (proprietário), funcionários com permissões, compradores (páginas públicas), consignadores (página de acompanhamento) e o administrador da plataforma.

## 2. O que NUNCA fazer

- Não escrever **cor literal** (`#fff`, `rgb()`) em componente ou página. Use `var(--token)`.
- Não criar classes novas se já existe uma equivalente em `design-system.md`.
- Não usar emoji como marcador de seção nem ícone fora do sprite.
- Não citar **"TCGdex"** na interface. Diga "catálogo de cartas".
- Não escrever **"anti-calote"** nem prometer garantia de pagamento, entrega ou segurança. A plataforma não realiza vendas.
- Não criar **cadastro aberto** ("Criar conta"). O acesso é por convite; o botão é "Solicitar acesso".
- Não pôr seletor de período nem auto-refresh na **Home**. Períodos só no Financeiro.
- Não pré-selecionar a **origem** da carta (Própria/Consignada).
- Não criar leilão com várias cartas: **um leilão = uma carta**.
- Não usar verde para algo que não seja ao vivo, lance ou ganho.
- Não deixar a página rolar na horizontal. Não esquecer o mobile.

## 3. Como gerar uma tela nova (receita)

1. Escolha o tipo: **app** (com shell), **admin**, **pública** ou **estado**.
2. Copie o esqueleto de uma tela parecida (`estoque.html` para listas, `cliente.html` para detalhe com abas, `estoque-novo.html` para formulário, `financeiro.html` para dashboards).
3. Estrutura de uma tela do app, dentro de `main.page`:
   - cabeçalho `.page-head` (título + ações) ou, em listas, `.filters`;
   - conteúdo em `.card` (com `.card__head` e `.card__foot` quando útil);
   - tabelas em `.table-wrap > .table`;
   - formulários em `.form-grid` com `.field`.
4. Marque o item do menu com `aria-current="page"` e use `<span class="lb">` nos rótulos.
5. Inclua os estados: **vazio** (`.empty`), **erro** (`.alert--danger`, `aria-invalid`) e o caso **sem permissão** quando a tela for restrita.
6. Use dados de exemplo realistas em português (cartas Pokémon, R$, telefones com máscara) e marque como exemplo quando não forem reais.
7. Confira nos dois temas e nos três tamanhos (desktop, tablet ≤1100px, mobile ≤640px).

### Esqueleto mínimo (tela do app)
```html
<div class="app">
  <div class="scrim" data-menu></div>
  <aside class="side">…</aside>
  <div>
    <header class="topbar">
      <button class="btn btn--ghost btn--icon menu-btn" data-menu aria-label="Abrir menu"><svg class="i"><use href="#i-menu"/></svg></button>
      <h1 class="topbar__title">Título</h1>
      <span class="status-chip status-chip--on">WhatsApp online</span>
    </header>
    <main class="page">
      <div class="page-head"><h2>Título</h2><div class="row"><a class="btn btn--primary" href="#">Ação</a></div></div>
      <section class="card"><div class="card__head"><h2 class="card__title">Bloco</h2></div><div class="card__body">…</div></section>
    </main>
  </div>
</div>
```

## 4. Padrões de página que se repetem

| Precisa de… | Use |
|---|---|
| Lista com filtros | `.filters` + `.card` com `.table` (linhas com `data-go`) |
| Formulário longo | `.card` por bloco + `.form-grid`; botões no fim, alinhados à direita |
| Abas | `.tabs` com `data-show="idDoPainel"` e painéis com `id` (os demais `hidden`) |
| Alternar campos | `.seg` com `data-show` |
| Confirmação / destrutivo | modal (`data-open`) com botão `.btn--danger` |
| Aviso crítico | `.alert` + `role="alert"` com ação |
| Carta em destaque | `.tcg` (no máximo uma grande por bloco) |
| Valor monetário ou ID | classe `mono`; `.num` em células de tabela |
| Status | `.badge` com a variação semântica certa |

Mapeamento de status → badge: Disponível (neutro) · Agendada em leilão (`info`) · Esperando confirmação (`warning`) · Vendida (`success`) · Consignada (`primary`) · Própria (`dashed`) · Bloqueado/Suspenso/Desconectado (`danger`) · Ao vivo (`success badge--live`).

## 5. Permissões e papéis (afetam a UI)

- **Proprietário**: tudo, incluindo Financeiro e log de atividades.
- **Funcionário**: permissões individuais — Cadastrar Estoque, Criar Leilões, Fazer Acertos, Ver Dashboard Financeiro, Deletar Itens/Registros (bloqueado por padrão).
- **Administrador** (`/admin`): cria lojas e usuários, define quem pode criar lojas; **não altera dados internos das lojas**.
- Sem permissão → tela `sem-permissao.html` (explica a permissão que falta).

## 6. Dados e fluxos que você precisa respeitar

- Fluxo do leilão: cadastrar carta → agendar (ou lançar agora, ou deixar para depois) → bot posta → lances → encerra → **Esperando confirmação** → acerto na página do cliente → **Vendida** → envio.
- Enquete: o lojista define um **valor teto**; ao atingi-lo, o encerramento precisa de aprovação.
- Visitante sem CPF/endereço: botão "Confirmar pagamento" desabilitado.
- Consignada: comissão da loja em %; o repasse ao dono é calculado e marcado como realizado no Financeiro.
- Link do consignador: `app.com/c/xxxx` + chave de 4 dígitos.
- Link do acerto do comprador: `app.com/acerto/xxxx`.

## 7. Checklist antes de entregar

- [ ] Só tokens de cor; nenhum literal.
- [ ] Só classes do design system (ou nova classe documentada em `design-system.md`).
- [ ] Funciona no tema claro e no escuro.
- [ ] Sem rolagem horizontal em 375px; tabelas viram cartões no mobile.
- [ ] Foco visível, labels nos campos, `aria-label` em ícones sozinhos.
- [ ] Textos em português do Brasil, sem as palavras proibidas da seção 2.
- [ ] Estados vazio/erro tratados quando fizer sentido.
- [ ] Links relativos para páginas existentes (`home.html`, `estoque.html`…).
- [ ] Nova tela adicionada ao `screens.md` e ao mapa `index.html`.

## 8. Como as páginas foram produzidas

As 41 páginas atuais foram geradas por um script que monta o shell (sidebar, topbar) e injeta o corpo de cada tela, copiando `tokens.css`, `components.css`, `app.js` e `icons.svg` ao lado. Se for criar uma tela à mão, siga o esqueleto da seção 3; se for recriar o gerador, ele só precisa produzir esse HTML. O sprite de ícones é embutido em cada página (porque `<use>` externo não é confiável entre origens).

## 9. Como pedir ajustes (para quem usa a LLM)

Descreva o que mudar por **tela + bloco + comportamento** ("Financeiro, gráfico de lances por horário: mesmo tamanho do de faixa de valor"). Mudanças de estilo global devem ser feitas em `tokens.css` ou `components.css` e depois copiadas para `app/`.
