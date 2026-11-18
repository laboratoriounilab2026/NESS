# Plano de execução — NESS
Versão 2.0 | Substitui o plano 1.0 ("Nota Ness")

## Problema que resolve
Hoje a NFS-e do serviço fotográfico é emitida e só depois, separadamente, a NF-e do álbum — o que atrasa o envio da encomenda. O NESS é um **emissor próprio** que, a partir de um único pedido, transmite as duas notas direto ao governo (SEFAZ para NF-e; Emissor Nacional/ADN para NFS-e), acompanha cada uma de forma independente e entrega o DANFE pronto para despachar.

Decisões: emissor próprio com transmissão direta; Next.js + Postgres; multi-estabelecimento (qualquer UF/regime, sempre via matriz fiscal aprovada).


### Arquitetura (monólito modular Next.js)
```
app/            UI (App Router) + route handlers /api
src/domain/     pedido, estados, regras de transição (puro, testável)
src/fiscal/     motor da matriz (regra aprovada+vigente ou bloqueio)
src/emitters/
  nfe/          XML 4.00, assinatura XMLDSig A1, SOAP SEFAZ (autorização, retorno, consulta, cancelamento, status), DANFE PDF
  nfse/         DPS padrão nacional, assinatura, API Sefin Nacional/ADN, DANFSe
  common/       certificado (carregado do secret manager), clientes HTTP mTLS, timeouts
src/orchestrator/ fila de jobs (pg-boss no próprio Postgres), idempotência, reconciliação
src/audit/      eventos append-only
prisma/         schema + migrações
```
Bibliotecas: Prisma, Zod (validação cliente+servidor), Auth.js (papéis), `xml-crypto`/`node-forge` para assinatura, `pg-boss` para jobs, Tailwind + tokens CSS, Lucide (ícones), Vitest + Playwright.

### Fluxo encadeado (o núcleo do problema)
1. Operador confirma pedido no wizard (7 etapas).
2. Orquestrador cria 2 `EmissionDocument` (NFSE, NFE) com idempotency key `pedido+tipo+tentativa`.
3. Job NFS-e transmite; job NF-e transmite **em paralelo ou em sequência conforme a matriz do cenário** (configurável: ex. NF-e referencia a NFS-e em informações complementares → sequência).
4. Cada job: envia → aguarda retorno → em timeout marca `INCERTO` e consulta (por chave/nº DPS) antes de reenviar.
5. Pedido fica `COMPLETO` só com as duas autorizações confirmadas; caso contrário `PARCIAL` com ação de retomar só a que falhou.
6. Tela final: DANFE pronto para imprimir/etiqueta de envio + DANFSe para o tomador; XMLs no repositório documental.

### Dados (Prisma)
Establishment (UF, município, regime, CNPJ, ambiente, séries, ref. ao segredo do certificado), Customer, Recipient, EmissionOrder, EmissionDocument (status independente, chave, protocolo, xml), EmissionAttempt (idempotency key único, correlation ID, resposta sanitizada), FiscalRule (escopo, parâmetros, versão, vigência, aprovador, justificativa), AuditEvent. Restrição `UNIQUE(order_id, doc_type, attempt_seq)`.

### Matriz fiscal multi-UF/regime
Regra resolvida por (estabelecimento, regime, UF origem/destino, município, finalidade). Sem regra aprovada e vigente → bloqueio com encaminhamento ao admin. Nenhum CFOP/CST/NCM/alíquota vem pré-preenchido no código; o seed só tem a **estrutura**, valores entram pelo painel admin com aprovação do contador.

### Estados
Pedido: Rascunho → Validando → Pronto para revisão → Emitindo → Completo | Emissão parcial | Rejeitada/falha → Cancelamento solicitado. Documento: Pendente → Enviado → Incerto → Autorizado | Rejeitado | Denegado → Cancelado. Transições em tabela única em `src/domain/` com teste.

### UI
Sidebar (Visão geral, Pedidos, Emissões, Documentos, Configuração fiscal, Auditoria), hero útil no dashboard ("Central de emissões", CTA Novo pedido, KPIs), wizard 7 etapas com autosave, revisão lado a lado NFS-e × NF-e, badges com texto+ícone, claro/escuro, WCAG AA, reduced-motion.

### Fases e gates
| Fase | Entrega | Gate |
|---|---|---|
| 0 | Bootstrap Next.js/Prisma/CI, logo, design tokens | build+lint ok |
| 1 | Domínio, estados, schema, auditoria | testes unitários de transição |
| 2 | Design system + dashboard + wizard (mock) | revisão a11y |
| 3 | Motor de matriz + painel admin com aprovação | bloqueio sem regra testado |
| 4 | Emissor NF-e em **homologação** SEFAZ | nota autorizada em homologação |
| 5 | Emissor NFS-e Nacional em **homologação** (ou adaptador municipal se a prefeitura não aderiu) | DPS autorizada em homologação |
| 6 | Orquestrador encadeado, idempotência, reconciliação | testes de falha parcial e timeout |
| 7 | Papéis, mascaramento, observabilidade | revisão de segurança |
| 8 | E2E Playwright, docs, treinamento | checklist final; produção só com autorização explícita |

### Situação em 17/11/2026
| Fase | Situação |
|---|---|
| 0–3 | Concluídas: app, domínio e estados, schema e auditoria, design system, matriz fiscal com aprovação, cadastro de pedido. |
| 6 | Concluída: orquestrador com idempotência, INCERTO só sai por consulta, sucesso parcial. Pedido é salvo com as duas notas; emissão e consulta pela tela, com confirmação; regra revalidada antes de cada envio. |
| 4 e 5 | **Bloqueadas** pelas pendências abaixo. Ponto de ligação pronto: `src/emitters/registry.ts` (hoje sem adaptador, envio bloqueado com explicação). |
| 7 | Parcial: log estruturado de erros sem dados pessoais (`src/instrumentation.ts`, digest = código da tela de erro); saúde em `/api/health` (200 ok / 503 sem banco, público, sem detalhes). papéis OPERADOR/FISCAL/ADMIN em toda página/ação, CPF/CNPJ mascarado na tela, auditoria sem dados pessoais. Falta enviar esses logs a um coletor e configurar alertas, ao definir a hospedagem. |
| 8 | Parcial: jornada E2E (`e2e/`, Playwright) e testes de integração com banco no job `e2e` do CI — **ainda não executados: as Actions do GitHub não rodam neste repositório** (0 execuções). Guia de uso em `docs/GUIA_DE_USO.md`. |

### Pendências que dependem de humano
- Município aderiu ao Emissor Nacional NFS-e? (senão, adaptador da prefeitura).
- Matriz fiscal por estabelecimento aprovada pelo contador (CFOP, CST/CSOSN, NCM do álbum, natureza, necessidade de DC-e).
- Certificado A1 por CNPJ e onde guardá-lo (secret manager).

## Critérios de aceite
- Um pedido gera as duas notas sem redigitação; operador não preenche campos fiscais técnicos.
- Tomador e destinatário podem ser diferentes e ficam explícitos.
- Cenário sem regra aprovada e vigente é bloqueado.
- Timeout/repetição nunca duplica nota; falha parcial é visível e retomável só no documento que falhou.
- XML, protocolos, DANFE e DANFSe recuperáveis pelo pedido; auditoria de quem preparou, revisou e emitiu.
- Produção apenas com autorização explícita, após homologação.

Este documento é especificação de produto e engenharia, não parecer tributário.

## Rastreio de entregas (adicionado em 17/11/2026)
Direção visual escolhida: tela 10 (Mosaico). Menu ganha **Rastreio**, no formato de mapa + linha do tempo (protótipo: `design/explorations/22-ness-rastreio.html`).
- Fonte: API Rastro dos Correios (CWS, `cwshom` para homologação). **Exige contrato comercial**; só rastreia objetos do contrato do remetente; token expira e é renovado. Sem webhook: consulta periódica (job pg-boss) dos objetos não entregues.
- **Decisão (17/11/2026): recurso opcional por empresa.** Só fica ativo para quem cadastrar contrato Correios (código de acesso CWS + cartão de postagem), validado em homologação. Sem contrato: menu Rastreio mostra estado "desativado" com instruções; emissão não é afetada. Sem alternativas não oficiais (scraping). Melhor Envio fica como possível integração futura.
- Regra: só pedido com NF-e autorizada pode receber código de rastreio.
- Dados: `Shipment` (pedido, transportadora, código, status) e `ShipmentEvent` (idempotente por código+data+descrição). Falha/timeout mantém último status confirmado e mostra horário da consulta.
- Privacidade: mapa e logs mostram só cidade/UF do destinatário; credencial no secret manager.
- Configuração por empresa: credencial no secret manager, só administradores configuram, mudança auditada.
