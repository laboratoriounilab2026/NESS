# Arquitetura e integração
- Mapear os emissores existentes antes de propor adaptadores.
- Preferir modularidade e contratos explícitos: Pedido de Emissão, Orquestrador, Motor de Configuração Fiscal, Adaptador NFS-e, Adaptador NF-e, Repositório Documental e Auditoria.
- Manter regras fiscais fora de componentes visuais e isoladas em configuração versionada/aprovada.
- Documentar contratos, estados, transições, retries, timeouts e reconciliação.
- Não criar microserviços apenas por preferência; respeitar o desenho e a escala do repositório atual.
- Toda migração deve ter plano de rollback e compatibilidade com dados existentes.
