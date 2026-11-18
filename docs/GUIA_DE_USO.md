# Guia de uso do NESS

Para quem vai usar o NESS no dia a dia: operador, responsável fiscal e administrador.
Cada pedido gera duas notas: a **NFS-e** do serviço fotográfico (para quem contratou) e a **NF-e** do álbum (acompanha a encomenda).

> **Situação atual:** a transmissão ao governo ainda não está ligada. Você já pode cadastrar empresas, regras e pedidos. Ao tentar emitir, o sistema avisa "Transmissão ao governo ainda não configurada" e **nada é enviado**.

## Papéis

| Papel | Pode |
|---|---|
| Operador | Cadastrar pedidos, corrigir o destinatário, emitir, consultar notas sem resposta |
| Responsável fiscal | Tudo do operador + criar e aprovar regras fiscais, liberar nova tentativa de nota rejeitada, ver auditoria |
| Administrador | Tudo do operador + cadastrar a empresa emissora, liberar nova tentativa, ver auditoria |

Contas são criadas, desativadas e têm a senha trocada por quem cuida do sistema, pelo terminal (`npm run user:create`, `user:disable`, `user:password`). Desativar ou trocar a senha encerra na hora as sessões abertas daquela pessoa. Não existe cadastro pela tela.

## Primeira configuração (uma vez por empresa)

1. **Administrador** — *Configuração fiscal › Estabelecimentos*: informe CNPJ, razão social, UF, código IBGE do município e regime tributário. A empresa entra sempre em **homologação** (ambiente de teste do governo).
2. **Responsável fiscal** — *Configuração fiscal › Regras fiscais*: crie uma regra para a NFS-e e outra para a NF-e, com os valores passados pelo contador, vigência e a **justificativa/origem** (parecer, consulta à SEFAZ, legislação).
3. **Responsável fiscal** — marque **Revisei** e clique em **Aprovar**. Só regra aprovada e dentro da vigência libera emissão. Ao aprovar, os pedidos que estavam bloqueados só por falta dessa regra ficam prontos para emitir automaticamente (a emissão continua exigindo confirmação).

Regra aprovada não muda. Para alterar, crie uma nova (ela vira a próxima versão) e aprove.

## Dia a dia: um pedido

Menu **Pedidos › Novo pedido**. São 7 etapas; o rascunho fica salvo enquanto a aba estiver aberta.

1. **Tomador** — quem contratou e paga o serviço (sai na NFS-e).
2. **Destinatário** — quem recebe o álbum e o endereço de entrega (sai na NF-e). Marque "O destinatário é o próprio tomador" se for a mesma pessoa.
3. **Serviço** — descrição e valor.
4. **Álbum** — descrição, quantidade e valor unitário.
5. **Verificação fiscal** — o sistema procura a regra aprovada de cada nota. Se faltar, o pedido pode ser salvo, mas fica **bloqueado**.
6. **Revisão** — confira as duas notas lado a lado.
7. **Confirmação** — marque "Conferi os dados das duas notas" e clique em **Salvar pedido**.

Você não preenche CFOP, NCM, alíquota nem nenhum código fiscal: eles vêm da regra aprovada.

### Emitir

Na página do pedido, marque a confirmação e clique em **Emitir notas**. Antes de enviar, o sistema confere de novo se as regras ainda valem.
Pedido salvo por engano? Enquanto nenhuma nota foi enviada, abra o pedido e use **Descartar pedido**: ele fica no histórico e não pode mais ser emitido.

Cada nota tem seu próprio resultado: uma pode ser autorizada e a outra não (o pedido fica em **emissão parcial**).

## Quando algo dá errado

| Você vê | O que significa | O que fazer |
|---|---|---|
| **Sem regra fiscal** | Falta regra aprovada e vigente para uma das notas | Avise o responsável fiscal. Depois que ele aprovar, clique em **Verificar regras de novo** |
| **Aguardando confirmação** | O governo não respondeu a tempo. A nota **pode** ter sido autorizada | **Não emita de novo.** Clique em **Consultar notas sem resposta** |
| **Transmitindo** por mais de alguns minutos | O envio foi interrompido antes da resposta | Clique em **Consultar notas sem resposta**. O sistema consulta o governo antes de qualquer reenvio |
| **Rejeitada** | O governo recusou; o motivo aparece no card da nota | Se for endereço, use **Corrigir destinatário da NF-e**. Depois, o responsável fiscal ou o administrador clica em **Liberar nova tentativa** |
| **Denegada** | O governo negou a nota de forma definitiva | Não há nova tentativa. Fale com o contador |

Se o problema for nos dados do **tomador** (NFS-e), cadastre um novo pedido: o cadastro do cliente é usado por outros pedidos e não é editado pela tela.

## Acompanhamento

- **Visão geral**: notas autorizadas, aguardando confirmação, emissões parciais, pedidos bloqueados e, enquanto houver, as **pendências de configuração** (o que falta para emitir e quem resolve).
- **Pedidos**: busca pelo nome do cliente e filtros por situação (aguardando confirmação, parciais ou com falha, sem regra fiscal, prontos para emitir), combináveis. Os contadores da visão geral levam direto ao filtro certo.
- **Documentos**: notas autorizadas, com número/série, chave de acesso e protocolo. Busca por número da nota, início da chave ou nome do cliente.
- **Emissões**: cada tentativa de envio, com data, nota e resultado.
- **Auditoria** (fiscal e administrador): quem fez o quê e quando. CPF, CNPJ e endereço não aparecem nos registros.
- **Rastreio**: ainda não ativo; depende de contrato com os Correios.
