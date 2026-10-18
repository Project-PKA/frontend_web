# Design system · Leilões TCG

Arquivos prontos para virar o projeto:

| Arquivo | Para quê |
|---|---|
| `tokens.css` | Cores (escuro padrão, claro por `prefers-color-scheme` ou `data-theme`), tipografia, espaçamento, raios, movimento |
| `components.css` | Botão, badge, status do WhatsApp, card, KPI, formulário, switch, segmented, abas, tabela, alerta, progresso, barras, anel, vazio, modal, card de leilão, shell (sidebar + topbar) |
| `icons.svg` | Sprite de ícones de traço (`<svg class="i"><use href="#i-home"/></svg>`) |
| `index.html` + `app.js` | Vitrine de componentes (só demonstração) |

## Regras
- Nunca usar cor literal em componente: sempre `var(--token)`.
- Verde (`--success`) é reservado para "ao vivo", lance e ganho. Violeta (`--primary`) é a ação principal.
- Tema: `data-theme="light|dark"` no `<html>`; sem atributo segue o sistema.
- Fontes: Sora (títulos e números), DM Sans (texto), JetBrains Mono (IDs, telefones, valores em tabela).
