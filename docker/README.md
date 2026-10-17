# Docker

Exemplos, nao configuracao ativa. O template nao sabe qual e a stack, entao
nao pode entregar um `Dockerfile` que funcione — e um `Dockerfile` quebrado
na raiz e pior que nenhum.

## Como usar

1. Escolha o exemplo que corresponde ao tipo de aplicacao:

   | Arquivo | Quando |
   | --- | --- |
   | `Dockerfile.static.example` | SPA ou site estatico (build para nginx) |
   | `Dockerfile.ssr.example` | SSR / servidor Node (build para node) |
   | `nginx.conf.example` | Acompanha o estatico |
   | `compose.yaml.example` | Rodar junto de um backend local |

2. Copie para a raiz sem o sufixo `.example`:

   ```sh
   cp docker/Dockerfile.static.example Dockerfile
   cp docker/compose.yaml.example compose.yaml
   ```

3. Substitua os `TODO` pelos comandos reais da stack — os mesmos que voce
   colocou em `project.mk`.

4. Acrescente `docker-build` / `docker-run` ao `project.mk` se quiser
   chama-los pelo `make`.

## Decisao: configuracao em build ou em runtime

Na maioria das builds de frontend as variaveis sao embutidas no bundle em
**tempo de build**. Consequencia: a imagem gerada para homologacao **nao**
pode ser promovida para producao — ela carrega a URL de homologacao dentro.

Se voce quer uma imagem por release, promovida entre ambientes, a
configuracao precisa ser lida em **runtime**: o servidor expoe um
`/config.json` (montado por ConfigMap, variavel de ambiente ou entrypoint) e
a aplicacao o busca no bootstrap. Registre a escolha em `ARCHITECTURE.md`.
