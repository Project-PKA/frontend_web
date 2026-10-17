# Politica de seguranca

## Reportando uma vulnerabilidade

**Nao abra issue publica.** Use
[Security → Report a vulnerability](../../security/advisories/new) (GitHub
Security Advisories privado) ou o canal privado do time de plataforma.

Inclua: passos para reproduzir, impacto estimado, versao/commit e ambiente
afetados. Tempo de primeira resposta: <!-- ex.: 2 dias uteis -->.

## O que a fundacao ja cobre

| Camada | Onde |
| --- | --- |
| SAST (fluxo de dados, XSS, redirect aberto) | `codeql.yml` |
| Dependencias vulneraveis | Dependabot (`.github/dependabot.yml`) + alerts |
| Segredo commitado | Secret scanning + push protection (`SETUP-GITHUB.md` A4) |
| Qualidade e hotspots de seguranca | SonarCloud, dentro do `ci-success` |
| Revisao humana | Checklist abaixo, cobrado no template de PR |

## Checklist OWASP Top 10 (visao de frontend)

Use ao revisar mudanca que toque autenticacao, dado sensivel, entrada do
usuario, HTML dinamico ou integracao externa:

1. **Broken Access Control** — a UI esconde, mas quem **nega** e o backend.
   Nenhuma regra de permissao existe so no cliente.
2. **Cryptographic Failures** — nada sensivel em `localStorage`/`sessionStorage`;
   token de sessao em cookie `HttpOnly` + `Secure` + `SameSite` quando possivel.
   Tudo por HTTPS.
3. **Injection (XSS)** — nada de `innerHTML`/`dangerouslySetInnerHTML`/`v-html`
   com dado externo sem sanitizacao; URL dinamica validada (bloqueie
   `javascript:`).
4. **Insecure Design** — limites e mensagens de erro nao revelam existencia de
   conta, stack ou detalhe interno.
5. **Security Misconfiguration** — headers de seguranca (CSP, HSTS,
   `X-Content-Type-Options`, `frame-ancestors`) configurados no servidor/CDN;
   source map de producao nao publico, ou publico de proposito.
6. **Vulnerable and Outdated Components** — Dependabot limpo; dependencia nova
   passa pela aprovacao humana (`AGENTS.md` secao 6).
7. **Identification and Authentication Failures** — fluxo de login, logout e
   renovacao de sessao segue o que esta em `ARCHITECTURE.md`; logout invalida
   de verdade.
8. **Software and Data Integrity Failures** — script de terceiro com SRI
   (`integrity`) ou servido do proprio dominio; lockfile commitado.
9. **Security Logging and Monitoring Failures** — erro de cliente reportado
   para a observabilidade sem token, cookie ou dado pessoal.
10. **SSRF / Open Redirect** — redirect pos-login so para rota interna ou
    allowlist.

## Segredos

Em frontend **nao existe segredo**: tudo que vai para o bundle e publico. Ver
`.env.example`, regra 1.
