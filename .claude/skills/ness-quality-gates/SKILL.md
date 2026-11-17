---
name: ness-quality-gates
description: Executa checklist de qualidade para cada entrega do módulo antes de marcar fase como concluída.
---
# Quality gates
- Build/lint/typecheck aplicáveis passam.
- Testes unitários, integração e E2E relevantes passam.
- Nenhum cenário fiscal sem aprovação fica habilitado.
- Sem duplicidade em reenvio, timeout e repetição de clique.
- Falha parcial representada e recuperável.
- Permissões server-side e auditoria verificadas.
- XML/protocolos/documentos recuperáveis pelo pedido.
- Acessibilidade e estados visuais revisados.
- Migração documentada e rollback considerado.
- Relatório final lista comandos executados, resultados reais, pendências e riscos.
