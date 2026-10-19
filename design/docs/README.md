# Documentação · Leilões TCG

Plataforma para lojistas de cartas Pokémon TCG organizarem **leilões em grupos de WhatsApp**: estoque, agenda de leilões, lances, acertos, consignados, vitrine pública e dashboards.

Esta pasta explica como o produto é desenhado e como o design system funciona. Foi escrita para pessoas e para LLMs que vão criar ou editar telas.

| Arquivo | Para quê |
|---|---|
| [`design-rules.md`](design-rules.md) | Regras de design: princípios, cor, tipografia, layout, responsividade, tema, textos e regras de negócio que afetam a interface |
| [`design-system.md`](design-system.md) | Referência técnica: tokens, componentes, utilitários de layout, ícones e comportamentos de JS |
| [`llm-guide.md`](llm-guide.md) | Guia direto para LLMs: contexto, como gerar uma tela nova, checklist e armadilhas |
| [`screens.md`](screens.md) | Mapa das 41 telas, fluxos e a permissão/regra de cada uma |

## Estrutura do projeto

```
app/
├── index.html            mapa de telas (entrada para navegar)
├── landing.html          landing page pública
├── *.html                demais telas (uma por arquivo)
├── tokens.css            tokens: cores, tipografia, espaçamento, raios, movimento
├── components.css        componentes e utilitários
├── app.js                comportamento mínimo (sem framework)
├── icons.svg             sprite de ícones (também embutido em cada página)
└── docs/                 esta documentação
```

A fonte da verdade do design system fica em `design-system/` (`tokens.css`, `components.css`, `app.js`, `icons.svg`). Os arquivos de `app/` são cópias geradas junto com as páginas. **Ao mudar um estilo, mude em `design-system/` e copie para `app/`.**

## Como ver as telas
Abra `index.html`. Todas as páginas são HTML estático e se navegam por links relativos (`home.html`, `estoque.html` …). Para servir localmente:

```bash
python -m http.server 8731 --directory app
```

## Resumo do produto em 6 linhas
1. O acesso é **somente por convite**: um administrador cria a loja e o proprietário; não existe cadastro aberto.
2. A loja cadastra cartas, agenda **um leilão por carta** (lance livre ou enquete) e um bot posta e registra os lances no grupo de WhatsApp.
3. A **vitrine pública** lista os leilões ao vivo de várias lojas e leva o comprador ao grupo da loja.
4. Quem arremata recebe um link para completar CPF e endereço; a loja confirma a venda quando recebe o pagamento.
5. Cartas **consignadas** têm link de acompanhamento para o dono (chave = 4 primeiros números do CPF) e repasse calculado no financeiro.
6. A plataforma **não vende, não processa pagamentos e não garante entrega**: isso é combinado entre loja e comprador.
