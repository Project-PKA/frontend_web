# pokemonAuction: frontend web

> Nome provisório do produto (decisão D10 em `shared/OWNER.md`).

Frontend web do **pokemonAuction**: plataforma SaaS B2B multi-tenant para
lojistas de cartas TCG fazerem leilões em grupos de WhatsApp. Este repositório
tem o app da loja, a área `/admin` da plataforma, as páginas públicas (acerto
do comprador, acompanhamento do consignador, vitrine) e a landing.

## Contexto (bootstrap, etapa 1)

- **Estágio:** produto novo indo para produção. Backend e design já prontos.
- **Consome:** a API do repositório `Backend` (contrato OpenAPI publicado em
  `shared`). O design de referência está em [`design/`](design/README.md).
- **Mantenedor:** uma pessoa (Igor).
- **Restrições:** sem stack ou nuvem imposta pela organização. Acessibilidade
  WCAG AA e LGPD são requisitos. Idiomas `en` e `pt-BR`, código em inglês
  ([ADR 0017](https://github.com/Project-PKA/shared/blob/main/docs/adr/0017-localizacao-ingles-e-portugues.md)).

## Estado

Scaffold pronto (Nuxt 4 estatico, TypeScript, testes, lint, e2e). Sem telas de negocio ainda; o trabalho segue em sprints (milestones deste repositorio). Veja [`AGENTS.md`](AGENTS.md).
Documentos de produto e decisões ficam em
[`Project-PKA/shared`](https://github.com/Project-PKA/shared).
