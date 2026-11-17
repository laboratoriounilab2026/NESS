# PROMPT MESTRE — EXECUÇÃO DO MÓDULO NESS

Você é o engenheiro líder responsável por transformar o planejamento do Módulo de Emissão de Notas para Fotografia em software funcional, integrado e pronto para validação.

## Objetivo
Implementar um fluxo único de pedido que permita preparar e emitir:
1. NFS-e referente ao serviço fotográfico.
2. NF-e relacionada ao álbum que acompanha a entrega, conforme matriz fiscal aprovada.

O NESS tem emissor próprio: transmite NF-e direto à SEFAZ e NFS-e ao Emissor Nacional (ou adaptador municipal). Siga `docs/PLANO_NESS.md`. Não invente APIs: implemente a partir dos manuais oficiais vigentes.

## Primeira instrução: não codifique imediatamente
Entre em modo de diagnóstico/planejamento:
- Leia `CLAUDE.md`, `.claude/rules/*`, skills e o plano de produto.
- Faça inventário do repositório, stack, banco, autenticação, cadastros, módulos de emissão e design system.
- Identifique os fluxos atuais de NFS-e e NF-e e como são chamados.
- Liste o que pode ser reutilizado, o que precisa de adaptador e o que está ausente.
- Consulte os agentes especialistas disponíveis.
- Entregue arquitetura proposta, mapa de arquivos, riscos, dependências, fases, critérios de aceite e dúvidas bloqueadoras.
- Não altere arquivos até eu aprovar o plano.

## Requisitos funcionais
Implementar a jornada:
1. Localizar pedido/cliente por nome, CPF/CNPJ ou referência; carregar cadastro e alertar documentos existentes.
2. Confirmar serviço/pacote, data e valor; validar código municipal/descrição pela configuração.
3. Confirmar álbum, modelo, descrição e quantidade; recuperar cadastro do item.
4. Confirmar destinatário e endereço; destinatário pode ser diferente do tomador; validar CEP, município e UF.
5. Resolver cenário fiscal com base somente em regra aprovada e vigente.
6. Revisar lado a lado os dados da NFS-e e NF-e, pessoas, endereço, valores e itens; explicar divergências.
7. Confirmar emissão; acompanhar autorização, protocolo, XML, documentos auxiliares e resultado parcial.

## Dados do pedido
Cliente/tomador, serviço/pacote, data, valor, álbum, quantidade, descrição, valor atribuído quando necessário, destinatário, endereço de entrega e observação opcional.

Não solicitar ao operador CFOP, CST/CSOSN, alíquota ou código municipal técnico.

## Administração
Configuração de emitente/estabelecimento, séries, certificados, ambientes; parâmetros municipais de NFS-e; matriz de NF-e por cenário; vínculos entre pedido e documentos; histórico de alterações com responsável, justificativa, data e vigência.

Cenário sem configuração ativa deve bloquear com mensagem clara e encaminhar para administração fiscal. Não escolher regra aproximada.

## Arquitetura-alvo (adaptar ao projeto real)
- Pedido de emissão consolidado.
- Orquestrador de etapas, validações, tentativas e dependências.
- Adaptador NFS-e para emissor/provedor existente.
- Adaptador NF-e para emissor existente.
- Motor de configuração fiscal.
- Repositório documental.
- Auditoria.
Autorização independente; emitir parcialmente é estado legítimo. Timeout deve ser reconciliado antes de qualquer reenvio. Idempotência por pedido e tipo de documento.

## Estados obrigatórios
Rascunho; Validando; Pronto para revisão; Emitindo; Completo; Emissão parcial; Rejeitada/falha; Cancelamento solicitado.
Defina transições, eventos e ações permitidas. Não colapsar estados independentes de NFS-e e NF-e em um único booleano.

## Direção visual obrigatória
Entregar interface com qualidade de produto SaaS profissional:
- Dashboard com hero section funcional: título, descrição contextual, CTA primário e indicadores.
- Sidebar organizada e topbar consistente.
- Cards de resumo, tabelas legíveis, filtros, busca, empty states, skeletons e feedback.
- Wizard com stepper de sete etapas, progresso, resumo, validação inline e revisão comparativa.
- Estados visuais claros para todos os estados fiscais; texto e ícone além da cor.
- Tema claro e escuro se a arquitetura permitir; responsivo em desktop, tablet e mobile.
- Tipografia, grid, espaçamento, cores, bordas, sombras e raios definidos em design tokens.
- Ícones Flaticon apenas se obtidos legalmente, com licença e atribuição verificadas; sem scraping ou download automatizado. Se não houver licença adequada, usar a biblioteca já instalada ou Lucide.
- Microinterações discretas, acessíveis, sem gamificação por velocidade.
- WCAG 2.1 AA como objetivo, foco visível, teclado e prefers-reduced-motion.
- Evite dashboard genérico de template e excesso de gradientes/glassmorphism.

## Requisitos não funcionais
Segurança de certificados e tokens; mascaramento de dados; autorização por papel; logs sem segredos; auditoria; validação server-side; resiliência a timeout; observabilidade com correlation ID; backup e retenção documental conforme política do cliente.

## Testes mínimos
- Tomador igual/diferente do destinatário.
- Entrega intraestadual e interestadual.
- Regra fiscal ausente, expirada, ambígua ou incompatível.
- NFS-e autorizada e NF-e rejeitada; cenário inverso.
- Timeout após envio e consulta de reconciliação.
- Clique duplo/retry sem duplicidade.
- Pedido já emitido/documento existente.
- Alteração de pedido após snapshot de emissão.
- Usuário sem permissão tentando emitir/cancelar.
- Acessibilidade, responsividade e estados de loading/erro/vazio.

## Plano de execução por fases
Fase 0 — Diagnóstico e mapa de integrações.
Fase 1 — Arquitetura, domínio, contratos e modelo de dados.
Fase 2 — Design system, protótipo e dashboard.
Fase 3 — Pedido consolidado e wizard de sete etapas.
Fase 4 — Motor de matriz fiscal e painel administrativo (somente regras aprovadas).
Fase 5 — Adaptadores para emissores existentes em homologação.
Fase 6 — Orquestração, idempotência, reconciliação e documentos.
Fase 7 — Auditoria, permissões, observabilidade e segurança.
Fase 8 — Testes integrados, revisão visual, documentação e aceite.

Trabalhe em fatias verticais pequenas. Ao concluir cada fase, apresente arquivos alterados, decisões, testes executados e pendências. Aguarde aprovação antes de avançar para operações de risco.

## Limites absolutos
- Não inventar regra fiscal nem declarar que orientação SEFAZ-SP se aplica a toda operação.
- Não emitir em produção, cancelar documentos reais ou usar certificados reais sem autorização explícita.
- Não apagar/substituir módulos existentes sem plano e aprovação.
- Não incluir credenciais em arquivos versionados.
- Não declarar sucesso sem evidência do emissor.
- Não marcar como concluído se os quality gates falharem.

Comece agora pela Fase 0. Faça diagnóstico, consulte os agentes e apresente o plano sem modificar o código.
