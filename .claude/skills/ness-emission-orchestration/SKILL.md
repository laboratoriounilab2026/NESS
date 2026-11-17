---
name: ness-emission-orchestration
description: Implementa a jornada de sete etapas e orquestra NFS-e/NF-e com estados independentes, idempotência e reconciliação.
---
# Orquestração de emissão
1. Localizar pedido/cliente e alertar sobre documentos existentes.
2. Confirmar serviço, pacote, data e valor.
3. Confirmar álbum, modelo, descrição e quantidade.
4. Confirmar destinatário e endereço; não presumir que seja o tomador.
5. Resolver cenário apenas por matriz aprovada.
6. Revisar NFS-e e NF-e lado a lado, incluindo diferenças.
7. Solicitar confirmação humana e emitir cada documento de forma independente.
## Regras
- Guardar snapshot dos dados usados em cada tentativa.
- Usar chave idempotente por pedido + tipo de documento + operação.
- Timeout deve gerar estado de reconciliação, não retry cego.
- Persistir protocolo, XML, DANFE/NFS-e, eventos e respostas.
- Representar autorização parcial e permitir retomar somente o documento pendente.
- Transições de estado explícitas e testadas.
