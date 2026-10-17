# 0001 — Registro de decisoes arquiteturais (ADR)

## Status

Aceito

## Contexto

Decisoes tecnicas relevantes precisam ficar rastreaveis: daqui a um ano,
quando alguem perguntar "por que nao usamos X?", a resposta precisa estar
escrita, com o contexto da epoca.

`ARCHITECTURE.md` secao 10 guarda decisoes curtas (uma linha). Decisao que
precisa de mais de um paragrafo vira ADR aqui.

Decisoes que afetam **mais de um repositorio** do projeto (contrato de API,
autenticacao entre servicos, formato de evento) nao ficam aqui: ficam no
`docs/adr/` do repositorio docs/shared.

## Decisao

Toda decisao relevante deste repositorio e registrada como
`docs/adr/NNNN-titulo-curto.md`, numerada em sequencia, usando o modelo
abaixo. Numero nao se reusa.

### Modelo

```markdown
# NNNN — Titulo curto no imperativo

## Status

Proposto | Aceito | Depreciado | Substituido por NNNN

## Contexto

Que problema ou forca motivou a decisao? Que restricoes existiam?

## Decisao

O que foi decidido, de forma direta e verificavel.

## Consequencias

O que fica mais facil ou mais dificil. Trade-offs aceitos conscientemente.

## Alternativas consideradas

O que mais foi avaliado e por que foi descartado.

## Quando reabrir

Que fato tornaria esta decisao errada.
```

## Consequencias

- Decisoes ficam rastreaveis e revisaveis.
- ADR aceito nao e editado; mudanca de direcao gera um ADR novo que
  referencia e substitui o anterior.
