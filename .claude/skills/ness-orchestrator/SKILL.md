---
name: ness-orchestrator
description: Planeja e coordena a implementação do módulo NESS de emissão integrada NFS-e e NF-e. Use para iniciar fases, decompor tarefas e consolidar entregas.
---
# Workflow do módulo NESS
1. Ler CLAUDE.md, regras e plano em docs.
2. Inspecionar o repositório e mapear emissores, cadastro, autenticação, banco e design system.
3. Não editar antes de apresentar diagnóstico, dependências e plano por fases.
4. Delegar análises independentes aos agentes: arquitetura, fiscal, design, integração, dados e QA.
5. Consolidar divergências; decisões fiscais ficam pendentes de aprovação humana.
6. Implementar em fatias verticais pequenas, com testes.
7. Revisar cada fase com QA e atualizar documentação.
8. Nunca executar emissão real, cancelamento real ou deploy sem autorização explícita.
## Entregáveis por fase
- Diagnóstico e mapa de reutilização.
- ADRs/decisões técnicas.
- Modelo de domínio e transições.
- Protótipo/implementação visual.
- Contratos de integração e mocks.
- Testes, evidências e checklist de aceite.
