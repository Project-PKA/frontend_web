# Design system · referência técnica

Arquivos: `tokens.css` (valores), `components.css` (componentes e utilitários), `app.js` (comportamento), `icons.svg` (ícones).
Convenção de classes: `.bloco`, `.bloco__elemento`, `.bloco--variação`, estados com `.is-*`.

## Como incluir numa página

```html
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=JetBrains+Mono:wght@400;500&family=Sora:wght@500;600;700&display=swap">
<link rel="stylesheet" href="tokens.css">
<link rel="stylesheet" href="components.css">
<!-- sprite de ícones inline (conteúdo de icons.svg) logo no início do <body> -->
<script src="app.js"></script>
```

Ícone: `<svg class="i"><use href="#i-home"/></svg>` (herda `currentColor`).

## Tokens (`tokens.css`)

**Tipografia:** `--font-display` (Sora), `--font-body` (DM Sans), `--font-mono` (JetBrains Mono). Escala `--fs-xs` 12px, `--fs-sm` 13, `--fs-md` 15, `--fs-lg` 18, `--fs-xl` 24, `--fs-2xl` 32, `--fs-3xl` 44.

**Espaço:** `--sp-1` 4px · `--sp-2` 8 · `--sp-3` 12 · `--sp-4` 16 · `--sp-5` 24 · `--sp-6` 32 · `--sp-7` 48.

**Forma/movimento:** `--radius-sm` 8, `--radius-md` 12, `--radius-lg` 16, `--radius-pill` 999px · `--ease`, `--dur` (0.18s).

**Cores:** `--bg`, `--bg-glow`, `--surface`, `--surface-2`, `--surface-3`, `--border`, `--border-strong`, `--overlay`, `--text`, `--text-2`, `--text-3`, `--primary` (+ `-hover`, `-press`, `-soft`, `-line`), `--on-primary`, `--success`/`--warning`/`--danger`/`--info` (cada um com `-soft`), `--shadow-card`, `--glow-primary`.

**Temas:** `:root` = escuro. Claro: `@media (prefers-color-scheme: light)` com `:root:not([data-theme="dark"])` e `:root[data-theme="light"]`. Forçar escuro: `:root[data-theme="dark"]`.

## Componentes

### Botão
`.btn` + variação: `.btn--primary` · `.btn--secondary` · `.btn--ghost` · `.btn--danger`. Tamanhos: `.btn--sm` (32px), padrão (40px), `.btn--lg` (48px). `.btn--icon` (quadrado), `.btn--block` (largura total). Funciona em `<button>` e `<a>`. `disabled` aplica opacidade e bloqueia.

```html
<a class="btn btn--primary" href="estoque-novo.html"><svg class="i"><use href="#i-plus"/></svg>Cadastrar carta</a>
```

### Badge e status
- `.badge` + `--primary|success|warning|danger|info|dashed`. `.badge--live` adiciona ponto pulsante (use com `--success` para "AO VIVO").
- `.status-chip--on` / `.status-chip--off`: status do WhatsApp na topbar (o `off` pisca).
- `.id-chip`: `#ID` em mono, copia ao clicar. `.thumb`: miniatura simples.

### Card
`.card` > `.card__head` (`.card__title` + ações) + `.card__body` + `.card__foot`.
Variações: `.card--interactive` (hover sobe), `.card--highlight` (borda e brilho violeta), `.frame` (cantos em colchete, usado nos KPIs).

### KPI
```html
<div class="card kpi frame">
  <div class="kpi__row"><span class="kpi__icon"><svg class="i"><use href="#i-bolt"/></svg></span><span class="badge badge--success badge--live">ao vivo</span></div>
  <div><div class="kpi__value">6</div><div class="kpi__label">Leilões ativos agora</div></div>
</div>
```
Grades: `.grid.grid--kpi` (auto-fit), `.grid.grid--kpi5` (5 itens, reorganiza em 3+2 e 2+2+1 conforme a largura).

### Formulário
`.field` > `.label` + `.input` | `.select` | `.textarea` + `.hint` (`.hint--error`). Erro: `aria-invalid="true"` no campo.
`.switch` (checkbox com trilho), `.check`, `.seg` (controle segmentado), `.tabs` + `.tab`. Seletores usam `.is-active`.
`.otp` (caixas de código; `.otp--keys` para a chave do consignador), `.suggest` + `.suggest__item` (autocomplete), `.photos` + `.drop` (espaços de foto), `.qr` (placeholder de QR Code).

### Tabela
`.table-wrap` > `table.table`. Células numéricas: classe `num` (alinha à direita, mono). Linhas clicáveis: `data-go="pagina.html"` no `<tr>`. **No mobile (≤640px) vira cartões**: o `app.js` copia o texto de cada `<th>` para `data-label` de cada `<td>`.

### Alerta
`.alert` + `--warning|danger|success|info`, com ícone, `.alert__body` (`.alert__title` + texto) e uma ação opcional. Usar `role="alert"` para avisos críticos.

### Dados e gráficos
`.progress`, `.bars`, `.ring` (anel com `--v`), `.hbar` (barras horizontais), `.legend` + `.dot`, `.pie-wrap`, `.chart` (SVG responsivo; texto `.ax`, linhas de grade `.gl`). Gráficos usam `--primary`, `--success`, `--info`, `--warning`.

### Estado vazio, avatar, modal
- `.empty` > `.empty__art` + título + texto + ação.
- `.avatar` (círculo).
- Modal: `.overlay` (com `.is-open`) > `.card.modal`. Abrir com `data-open="idDoOverlay"`, fechar com `data-close`, Esc ou clique fora.

### Carta com efeito holográfico
```html
<div class="tcg"><img class="tcg__art" src="carta.webp" alt="Charizard ex 199/165"></div>
<div class="tcg tcg--reverse">…</div>   <!-- reflexo diagonal -->
<span class="tcg tcg--xs">…</span>       <!-- miniatura (30px) para tabelas -->
```
Proporção 2,5:3,5. Camadas: faixa de brilho animada, reflexo que segue o ponteiro e inclinação 3D (`--x`, `--y`, `--rx`, `--ry` definidos pelo `app.js`). Sem imagem, use `.tcg__ph` (placeholder). Dentro de `.auction`, a carta é centralizada com largura limitada.

### Card de leilão
`.auction` com `.auction__top`, `.tcg`, `.auction__name`, `.auction__bid` (maior lance em verde) e botão "Ir para o leilão". Usado na vitrine pública e na landing. Grade: `.market`.

### Shell da aplicação
```html
<div class="app">
  <div class="scrim" data-menu></div>
  <aside class="side">…brand, .store-switch, nav.nav (a.nav__item[aria-current="page"]), .side__foot…</aside>
  <div>
    <header class="topbar">…botão ☰ (.menu-btn data-menu), h1.topbar__title, tema, .status-chip, sino…</header>
    <main class="page">…conteúdo…</main>
  </div>
</div>
```
Rótulos de texto da sidebar ficam em `<span class="lb">` (escondidos no modo trilho). Item ativo: `aria-current="page"`.

### Seleção de loja (carrossel)
`.deck-wrap` > `#deck.deck` com cartas `.tcg.store-card` (a central recebe `.is-sel`), botões `#deckPrev` / `#deckNext` e `#dots`.

### Outros
`.accordion` (FAQ com `<details>`), `.bidlist` + `.bid` (lista de lances; o primeiro é o maior), `.win` (vencedor), `.kv` (par rótulo/valor), `.feed` (notificações), `.perm` (linha de permissão), `.pub-top` + `.wrap` + `.center-page` + `.narrow`/`.narrow-lg` (telas públicas).

## Utilitários de layout
`.stack` (coluna com gap), `.row` (linha com wrap), `.grow`, `.right`, `.mono`, `.muted`, `.faint`, `.eyebrow`, `.page-head`, `.crumb`, `.filters` (+ `.end` à direita), `.form-grid` (+ `.full`), `.cols-2`, `.cols-2--stretch` (último card da coluna direita estica), `.cols-3`, `.cols-21`, `.tabpanel`.

## Comportamentos (`app.js`)

Sem framework, tudo por atributos:

| Atributo / elemento | Efeito |
|---|---|
| `data-theme-set="light|dark|system"` | troca o tema (`data-theme` no `<html>`) |
| `.seg`, `.tabs` | marca um botão ativo por grupo |
| `data-show="id1 id2"` / `data-hide="…"` | mostra e esconde painéis (`hidden`); em `.seg`/`.tabs` esconde os alvos dos irmãos |
| `data-open="id"` / `data-close` | abre e fecha modal |
| `data-mask="tel|cpf|cep"` | máscara de telefone, CPF ou CEP |
| `.otp input` | avança sozinho entre as caixas |
| `data-copy="texto"` | copia o texto |
| `.id-chip` | copia o `#ID` |
| `data-menu` | abre e fecha a gaveta da sidebar no mobile |
| `data-wa-demo` + `[data-wa-on]` / `[data-wa-off]` | demonstração: alterna o WhatsApp online/desconectado |
| `.tcg` | reflexo e inclinação seguem o ponteiro |
| `#deck` | carrossel de lojas |
| `.table` | rótulos de coluna para o modo cartão |

## Ícones disponíveis
home, box, bolt, users, shield, sliders, wallet, truck, bell, search, plus, check, x, copy, external, clock, message, chevron, alert, user, chart, store, link, menu, camera, lock, calendar, trash, edit, log, mail, phone, download, refresh, filter, eye. Estilo de traço de 1,75px em grade 24×24. Para criar outro, adicionar um `<symbol id="i-nome">` ao `icons.svg` e ao sprite inline das páginas.

## Breakpoints
`1180px` (grade de 5 KPIs reorganiza) · `1100px` (colunas empilham; 901–1100 sidebar em trilho) · `900px` (sidebar vira gaveta) · `640px` (tabelas em cartões) · `560px` (KPIs em 2 colunas).
