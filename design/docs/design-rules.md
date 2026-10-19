# Regras de design

## 1. Princípios

1. **Operacional primeiro.** O usuário é um lojista tocando leilões frenéticos. Sem gordura visual: tabelas limpas, status claros, ações visíveis, o que precisa de atenção em destaque.
2. **Ao vivo é verde.** O verde-limão (`--success`) é reservado para "ao vivo", lance e ganho. Não usar verde como decoração.
3. **Violeta é a ação.** `--primary` é a cor da ação principal e do item ativo. Só **um** botão primário por região.
4. **Estado em forma, não só em número.** Badges, chips e faixas de cor comunicam o estado (ao vivo, pendente, bloqueado) antes de o usuário ler.
5. **Honestidade sobre o produto.** A plataforma organiza leilões; não vende, não cobra do comprador e não garante nada. A interface nunca promete o contrário.
6. **Dark-first, light de verdade.** O escuro é o padrão e o claro é um tema completo (não uma inversão). Os dois precisam ficar legíveis.

## 2. Direção visual

Fundo preto-arroxeado, cards de vidro com borda sutil e brilho suave, acento violeta, verde-limão para dados ao vivo, cantos em colchete nos KPIs (`.frame`). Referências: painéis de trading e analytics escuros com acento neon.

- **Cartas** têm efeito holográfico (`.tcg`): brilho que corre, reflexo que segue o ponteiro e leve inclinação. Aparece sempre que a carta é protagonista (vitrine, leilão, monitor, detalhe, consignador, seleção de loja). Miniaturas em tabela usam `.tcg--xs`.
- Sombras e brilhos são discretos. O brilho violeta (`--glow-primary`) é só para ação principal e destaque.

## 3. Cor

Use **sempre tokens** (`var(--…)`). Nunca escreva cor literal em componente ou página.

| Papel | Token | Uso |
|---|---|---|
| Fundo da página | `--bg` | `body` (com `--bg-glow`) |
| Superfícies | `--surface`, `--surface-2`, `--surface-3` | cards, campos, trilhas |
| Bordas | `--border`, `--border-strong` | divisórias e campos |
| Texto | `--text`, `--text-2`, `--text-3` | principal, secundário, apoio |
| Ação | `--primary`, `--primary-hover`, `--primary-press`, `--primary-soft`, `--primary-line`, `--on-primary` | botões, item ativo, foco |
| Ao vivo / ganho | `--success`, `--success-soft` | lance, vendida, ao vivo |
| Atenção | `--warning`, `--warning-soft` | pendências |
| Erro / risco | `--danger`, `--danger-soft` | desconectado, blacklist, excluir |
| Informação | `--info`, `--info-soft` | enquete, dados neutros em destaque |

Regras:
- Cada cor semântica tem versão `-soft` para fundos de badge e alerta. Texto usa a cor cheia.
- Gráficos usam `--primary`, `--success`, `--info`, `--warning` nessa ordem.
- O verde de "ao vivo" no tema claro é mais escuro (`#3f7d0a`) para manter contraste.

## 4. Tipografia

| Papel | Fonte | Onde |
|---|---|---|
| Display | **Sora** 500/600/700 | títulos, números de KPI, preços |
| Corpo | **DM Sans** 400/500/700 | texto corrido e rótulos |
| Mono | **JetBrains Mono** 400/500 | `#ID`, telefones, valores em tabela, horários |

Escala (`--fs-*`): xs 12 · sm 13 · md 15 · lg 18 · xl 24 · 2xl 32 · 3xl 44.
- Valores numéricos usam `font-variant-numeric: tabular-nums` (já nos componentes).
- Rótulos de coluna de tabela: 11px, maiúsculas, espaçamento de letras.
- Texto corrido: no máximo ~65 caracteres de largura.

## 5. Espaçamento, forma e movimento

- Grade de 4px: `--sp-1` 4 · `--sp-2` 8 · `--sp-3` 12 · `--sp-4` 16 · `--sp-5` 24 · `--sp-6` 32 · `--sp-7` 48.
- Raios: `--radius-sm` 8 · `--radius-md` 12 · `--radius-lg` 16 · `--radius-pill`.
- Use `gap` em flex/grid em vez de margens soltas.
- Movimento curto: `--dur` 0.18s com `--ease`. Respeitar `prefers-reduced-motion` (os componentes já respeitam; o efeito `.tcg` desliga brilho animado e inclinação).

## 6. Layout das telas

**Shell do app:** sidebar fixa (sticky, altura da janela, rola por dentro se precisar) + topbar + `main.page`.
- Sidebar: logo, seletor de loja, navegação (Home, Estoque, Leilões, Clientes, Envios, Funcionários, Configurações, Financeiro), perfil no rodapé.
- Topbar (global): título da página, seletor de tema, **status do WhatsApp** (online verde / desconectado vermelho piscando) e sino de notificações.
- **A Home não tem seletor de período nem controle de auto-refresh.** Períodos (Hoje, 7, 15, 30 dias) existem só no Financeiro. Atualização de dados é por componente.

**Ordem de uma página:** cabeçalho (título + ações) → filtros → conteúdo (cards/tabelas) → rodapé de card com nota.

**Telas públicas** (landing, login, vitrine, acerto, consignado, termos…) não têm sidebar; usam `.pub-top` com logo e ações.

**/admin** usa o mesmo shell com sidebar própria (fundo `--surface-2`) e selo "/admin".

## 7. Responsividade

Três modos, todos obrigatórios:

| Largura | Comportamento |
|---|---|
| ≥ 1101px (desktop) | sidebar completa de 240px |
| 901–1100px (tablet) | sidebar vira **trilho de ícones** (72px), colunas duplas empilham |
| ≤ 900px (mobile) | sidebar some e abre como **gaveta** pelo botão ☰ |
| ≤ 640px | **tabelas viram cartões** (cada linha vira um bloco com rótulos) e filtros ocupam a largura toda |

Nunca deve haver rolagem horizontal da página. Só tabelas, gráficos e blocos de código podem rolar em um contêiner próprio.

## 8. Tema (claro, escuro, sistema)

- `:root` define o tema escuro; o claro entra por `prefers-color-scheme` ou `data-theme="light"`; `data-theme="dark"` força o escuro.
- O usuário escolhe em **Perfil > Tema padrão** (Claro, Escuro, Sistema) e há um atalho na topbar.
- Toda nova cor precisa ter valor nos dois temas, em `tokens.css`.

## 9. Textos (copy)

- Português do Brasil, direto, na voz do usuário. Botões dizem o que acontece ("Agendar leilão", não "Enviar").
- Erros explicam o que houve e como corrigir.
- Moeda no formato `R$ 1.240,00`. Telefone `(11) 98877-1020`. CPF `000.000.000-00`. Datas curtas `12/10`, horas `21:42`.
- `#ID` de carta em mono e copiável.
- **Não usar:** "TCGdex" na interface (use "catálogo de cartas"); "anti-calote" ou qualquer promessa de garantia; emojis como marcadores.

## 10. Acessibilidade

- Foco visível (`:focus-visible`), alvos de toque de pelo menos 32px nas ações pequenas e 40px nas padrão.
- Todo campo tem `<label>`; ícones sozinhos têm `aria-label`.
- Contraste de texto suficiente nos dois temas; estado nunca é só cor (sempre há texto ou ícone).
- Modais usam `role="dialog"`, fecham com Esc e com clique fora.

## 11. Regras de negócio que mudam a interface

1. **Acesso por convite.** Sem "Criar conta". A landing tem "Solicitar acesso". O card "Criar nova loja" só aparece para quem o administrador liberou.
2. **Um leilão = uma carta.** Não há leilão com várias cartas.
3. **Origem da carta não vem pré-selecionada** (Própria ou Consignada) e o botão de salvar fica desabilitado até a escolha.
4. **Cartas sem leilão agendado** aparecem na Home como lembrete e como KPI.
5. **Visitante** (sem CPF/endereço) não tem a venda confirmada até completar o cadastro.
6. **Excluir registros** exige permissão e vem bloqueado por padrão para funcionários.
7. **Pagamento e envio** são entre loja e comprador; a página de acerto diz isso.
8. **Chave do consignador:** 4 primeiros números do CPF, em 4 caixas separadas. É uma chave fraca; prever limite de tentativas e expiração do link.
9. **WhatsApp desconectado** é um estado crítico: faixa vermelha, chip piscando e leilões afetados com opção de estender o prazo.
