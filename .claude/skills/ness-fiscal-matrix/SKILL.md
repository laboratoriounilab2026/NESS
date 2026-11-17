---
name: ness-fiscal-matrix
description: Define, valida tecnicamente e aplica uma matriz fiscal fornecida e aprovada; bloqueia cenários sem regra válida.
---
# Matriz fiscal segura
- Exigir fonte formal, responsável aprovador, estabelecimento, regime, UF origem/destino, município quando aplicável, tipo de operação e vigência.
- Não preencher lacunas por inferência ou copiar CFOP/CST/CSOSN de outro cenário.
- Criar configuração versionada, status draft/review/approved/active/expired e trilha de alterações.
- O motor seleciona somente regra aprovada e vigente.
- Retornar códigos de bloqueio acionáveis para ausência, conflito ou expiração.
- Testar limites de vigência, destino interestadual, destinatário distinto, regime divergente e regra ambígua.
- Registrar claramente o que depende de validação do contador.
