# Mapa de telas

41 telas, uma por arquivo `.html` em `app/`. Abra `index.html` para navegar.

## Públicas e de entrada
| Arquivo | Tela | Observações |
|---|---|---|
| `landing.html` | Landing page | Hero, como funciona, funcionalidades, vitrine, dashboards, planos, FAQ e formulário de solicitação de acesso. Pensada para SEO |
| `login.html` | Login sem senha | Estado A: e-mail. Estado B: código de 6 dígitos |
| `solicitar.html` | Solicitar acesso | Substitui o cadastro aberto |
| `lojas.html` | Seleção de loja | Cartas em carrossel, com efeito holográfico. "Criar nova loja" só para quem tem permissão |
| `nova-loja.html` | Criar nova loja | Dados, QR do WhatsApp e escolha do grupo |
| `convite.html` | Aceitar convite | Mostra o papel e as permissões do funcionário |
| `vitrine.html` | Leilões ao vivo (pública) | Cartas de várias lojas, último lance, botão para o grupo |
| `acerto.html` | Acerto do comprador | Resumo, CPF/endereço, chave PIX da loja, comprovante |
| `consignado.html` | Acompanhar carta (consignador) | Chave de 4 dígitos; lances ao vivo; estimativa de repasse |
| `termos.html`, `privacidade.html` | Termos de uso, Política de Privacidade (LGPD) | Texto ilustrativo para revisão jurídica |
| `404.html` | Página não encontrada | |

## App (por loja)
| Arquivo | Tela | Observações |
|---|---|---|
| `home.html` | Home | Alerta de enquetes, 5 KPIs ao vivo, cartas sem leilão, fila de acertos. Sem período e sem auto-refresh |
| `estoque.html` | Estoque | Filtros por status, origem e idioma; `#ID` copiável; linha abre a carta |
| `estoque-novo.html` | Cadastrar carta | Uma tela só: busca + arte, dados e estado físico (com observações), origem (sem pré-seleção), leilão (agendar, lançar agora ou deixar para depois) |
| `carta.html` | Detalhe da carta | Dados, fotos, observações, histórico de leilões |
| `leiloes.html` | Leilões | Abas Em andamento, Agendados, Encerrados; "Novo leilão" em modal |
| `leilao.html` | Monitor do leilão | Carta, maior lance e lances recebidos do WhatsApp |
| `leilao-encerrado.html` | Leilão encerrado | Vencedor com link para o cliente |
| `leilao-editar.html` | Editar leilão | Reagendar, tipo, valores, cancelar |
| `enquete.html` | Aprovar enquete | Valor teto, lance atual, vencedor provisório |
| `clientes.html` | Clientes | Visitante, cadastrado ou consignador |
| `cliente.html` | Cliente | Dados e endereço; abas Acertos pendentes, Histórico, Carteira de consignação |
| `blacklist.html` | Blacklist e inatividade | Números bloqueados e regra de expulsão por inatividade |
| `envios.html` | Envios | A enviar, enviado, entregue; rastreio e aviso ao cliente |
| `funcionarios.html` | Funcionários | Convite e matriz de permissões |
| `config.html` | Configurações | WhatsApp, grupo, assinatura, vitrine pública, mensagens automáticas |
| `plano.html` | Plano e cobrança | Uso do plano, forma de pagamento, faturas |
| `financeiro.html` | Financeiro | Período, KPIs, gráficos, repasses de consignação. Exige permissão |
| `atividade.html` | Notificações e log | Log visível só ao proprietário |
| `perfil.html` | Meu perfil | Dados, endereço, idioma, tema, notificações, segurança |

## Estados
| Arquivo | Quando aparece |
|---|---|
| `home-vazia.html` | Loja nova, sem cartas: checklist de 4 passos |
| `estoque-vazio.html` | Estoque sem cartas |
| `wa-caiu.html` | WhatsApp desconectado com leilões ativos |
| `sem-permissao.html` | Usuário sem a permissão necessária |
| `404.html` | Endereço inexistente |

## /admin
| Arquivo | Tela |
|---|---|
| `admin.html` | Painel (usuários, lojas, convites, solicitações) |
| `admin-usuarios.html` | Lista de usuários, "Cadastrar usuário" |
| `admin-usuario.html` | Usuário: permissões globais (criar lojas e limite), suspender |
| `admin-lojas.html` | Lojas, "Transferir propriedade" |
| `admin-loja-nova.html` | Criar loja e definir o proprietário |
| `admin-convites.html` | Convites enviados e solicitações de acesso |

## Fluxos principais

**Entrada:** landing → solicitar acesso → (admin cria loja e convida) → convite → login → lojas → home.

**Leilão:** estoque-novo (cadastro + agendamento) → leiloes → leilao (monitor) → [enquete: aprovar] → cliente (acerto) → envios.

**Comprador:** vitrine → grupo de WhatsApp (lance) → acerto (CPF, endereço, pagamento à loja).

**Consignado:** estoque-novo (origem Consignada, gera link) → consignado (dono acompanha) → financeiro (repasse).

**Crítico:** WhatsApp cai → faixa na Home → wa-caiu (reconectar e estender prazos).
