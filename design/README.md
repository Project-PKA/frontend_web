# design/: protótipo de UI/UX (baixa fidelidade)

> Registro do design do **pokemonAuction** (nome provisório), gerado no **Claude Design** em
> 2026-10-17. Fica aqui para (1) servir de **fonte das telas** na implementação e (2) poder ser
> **reaberto no Claude Design** quando algo precisar mudar.

## O que é

- 41 telas em HTML estático (`*.html`), navegáveis por links relativos. Comece por `index.html`
  (mapa de telas) ou `landing.html`.
- `design-system/` é a **fonte da verdade** de estilo e comportamento (`tokens.css`,
  `components.css`, `app.js`, `icons.svg`). Os mesmos arquivos aparecem na raiz desta pasta
  porque o protótipo os usa lado a lado com as páginas. **Ao mudar um estilo, mude em
  `design-system/` e copie para a raiz.**
- `docs/` explica as regras: `design-rules.md`, `design-system.md`, `screens.md` (mapa das telas
  com a permissão de cada uma) e `llm-guide.md` (guia para quem for gerar ou editar telas).
- `wireframes/` tem os wireframes dos leilões e da Home.

> Nos textos de `docs/`, a pasta se chama `app/`. Aqui ela é `design/`: é a mesma estrutura.

## Como ver

```bash
python -m http.server 8731 --directory design
# abra http://localhost:8731/index.html
```

Tema claro e escuro, e três larguras (desktop, tablet até 1100px, mobile até 640px).

## Como mudar o design no futuro (Claude Design)

1. Abra o Claude Design e **anexe esta pasta** (ou o `design-system/` mais `docs/llm-guide.md` e
   `docs/design-rules.md`, que bastam para ele seguir as regras).
2. Peça a mudança. Peça também que ele **atualize `docs/screens.md`** se a tela, o fluxo ou a
   permissão mudarem.
3. Traga o resultado de volta para esta pasta, abra um PR e revise o diff. **Não edite as telas
   na mão em dois lugares**: o design é a origem, o código do frontend é derivado dele.
4. Regra de ouro (de `docs/llm-guide.md`): sem cor literal, sem classe nova se já existe uma
   equivalente, sem emoji como ícone, sem citar a marca do catálogo na interface.

## Relação com o produto

O escopo, as regras e o mapa de telas do produto estão em
[`shared/docs/produto.md`](https://github.com/Project-PKA/shared/blob/main/docs/produto.md). Quando o
design e o produto divergirem, **pergunte ao dono** (canal: `shared/OWNER.md`); não escolha.

## Divergências já conhecidas entre o protótipo e as decisões do projeto

| Tema | O protótipo mostra | O projeto decidiu | O que fazer na implementação |
| --- | --- | --- | --- |
| Acompanhamento do consignador | Só a chave de 4 dígitos do CPF | [ADR 0014](https://github.com/Project-PKA/shared/blob/main/docs/adr/0014-paginas-publicas-por-link-e-vitrine.md): o link leva um **token de alta entropia**, os 4 dígitos são **segundo fator**, e há **limite de tentativas e bloqueio** | A tela precisa tratar erro genérico, bloqueio temporário e link expirado ou revogado |
| Fontes | Carregadas do Google Fonts (`fonts.googleapis.com`) | Nada na decisão ainda | **Autohospedar** as fontes em produção: carregar do Google expõe o IP de quem visita a terceiros (LGPD) |
| Dados de exemplo | E-mails `@loja.com`, `@cards.com`, telefones e CPF `000.000.000-00` | São fictícios | Nunca usar como dado real nem como seed; o seed do Backend usa `@example.com` |
| Cadastro | Botão "Solicitar acesso", sem "Criar conta" | [ADR 0012](https://github.com/Project-PKA/shared/blob/main/docs/adr/0012-acesso-somente-por-convite-e-administracao-da-plataforma.md) | Manter: não existe cadastro aberto |
| Linguagem de garantia | Evita "anti-calote" | [ADR 0013](https://github.com/Project-PKA/shared/blob/main/docs/adr/0013-plataforma-nao-vende-nem-garante-pagamento-ou-entrega.md) | Manter em toda tela, e-mail e mensagem |

## Estado

Protótipo **navegável**, sem dados reais e sem chamadas à API. A implementação (stack, roteador,
tipos gerados do contrato) começa no bootstrap do frontend: issue
[frontend_web#4](https://github.com/Project-PKA/frontend_web/issues/4).
