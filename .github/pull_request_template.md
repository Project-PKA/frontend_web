<!--
Titulo do PR em Conventional Commits — ele vira a mensagem do squash merge:
  feat(checkout): adiciona validacao de cupom
  fix(api): trata timeout do endpoint de sessao
O CI valida titulo, commits e nome da branch.
-->

## O que muda

<!-- Uma ou duas frases, em linguagem de produto. -->

## Por que

<!-- O motivo. Se ja esta na issue, aponte para ela em vez de repetir. -->

Closes #

## Como testar

<!-- Passo a passo para o revisor validar na mao. Inclua usuario/dado de
     teste quando precisar, e a URL do ambiente onde da para ver rodando. -->

1.
2.

## Tipo de mudanca

- [ ] `feat` — funcionalidade nova
- [ ] `fix` — correcao de bug
- [ ] `refactor` — muda o codigo sem mudar comportamento
- [ ] `perf` — melhora performance
- [ ] `docs` — so documentacao
- [ ] `test` — so testes
- [ ] `build` / `ci` / `chore` — infra e ferramentas

## Evidencia

<!-- Print, gif ou video do antes e depois. Obrigatorio quando muda UI.
     Inclua a versao mobile. -->

**Design de referencia:** <!-- link da tela/frame (Claude Design, Figma...), ou "nao se aplica" -->

- [ ] A implementacao confere com o design de referencia
- [ ] Diverge de proposito: <!-- o que e por que (ex.: contraste insuficiente no design) -->
- [ ] Nao ha design para esta mudanca

## Checklist do autor

- [ ] `make validate` passa localmente
- [ ] `make build` passa
- [ ] `make e2e` passa (ou nao se aplica a esta mudanca)
- [ ] Testes cobrindo o comportamento novo ou o bug corrigido
- [ ] Sem log de depuracao, teste `only`/`skip`, ou TODO sem issue vinculada
- [ ] Variavel de ambiente nova documentada em `.env.example` e na leitura
      validada de ambiente
- [ ] Chamadas de rede passam pela camada isolada (nada de cliente HTTP solto)
- [ ] Tipos de API vem do contrato gerado, nao escritos a mao
- [ ] Documentacao atualizada quando o comportamento mudou
      (`ARCHITECTURE.md`, `AGENTS.md`, `README.md`)

## Acessibilidade

- [ ] Navegavel so pelo teclado, com foco visivel
- [ ] Marcacao semantica e rotulos adequados (sem elemento generico clicavel)
- [ ] Contraste de texto >= 4.5:1
- [ ] Nao se aplica <!-- justifique: -->

## Performance

- [ ] `make bundle-budget` passa
- [ ] Dependencia nova? Justifique o peso: <!-- -->
- [ ] Sem requisicao em cascata nem re-render desnecessario introduzido

## Risco e rollback

**Risco:** <!-- baixo / medio / alto -->

**Como reverter:** <!-- revert do merge basta? precisa de flag, migracao, aviso? -->

## Precisa de aprovacao humana explicita?

<!-- Marque se o PR toca algo da secao 6 do AGENTS.md. -->

- [ ] Muda `project.mk` de forma que altere o que o CI executa
- [ ] Muda workflow de CI/CD ou permissao de token
- [ ] Muda configuracao de ambiente, secret ou infraestrutura
- [ ] Adiciona ou remove dependencia
- [ ] Muda o contrato de API consumido
- [ ] Afrouxa regra de qualidade (lint, cobertura, orcamento de bundle, `skip`)
- [ ] Nada acima
