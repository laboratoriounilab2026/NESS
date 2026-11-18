# Lacunas para montar o XML da NF-e e da DPS

Levantamento de **quais dados as notas exigem e o NESS ainda não tem**, feito antes de escrever os XMLs (Fases 4/5).
Os grupos e campos vêm do layout da NF-e 4.00 e da DPS nacional, de memória técnica: **conferir cada item contra o
Manual de Orientação do Contribuinte (NF-e) e o XSD/manual vigente da NFS-e nacional** antes de implementar.
Nenhum valor fiscal é sugerido aqui: onde o campo é decisão tributária, ele vai para a **regra fiscal aprovada**.

Legenda: ✅ já existe · 🟡 falta no cadastro (dado operacional) · 🔷 decisão fiscal (regra aprovada pelo contador) · ⚙️ o sistema calcula

## NF-e (álbum)

| Grupo / campo | Situação | Observação |
|---|---|---|
| ide: série, número, chave, cNF, cDV | ✅ ⚙️ | `numbering.ts`, `access-key.ts` |
| ide: natOp | ✅ 🔷 | parâmetro da regra |
| ide: tpAmb | ✅ | homologação/produção do estabelecimento |
| ide: idDest (interna/interestadual) | ⚙️ | UF do emitente × UF do destinatário |
| ide: cMunFG (município do fato gerador) | ✅ | `Establishment.municipioIbge` |
| ide: indFinal, indPres, finNFe | 🔷 | consumidor final? venda presencial/internet? finalidade — **não estão na regra hoje** |
| emit: CNPJ, razão social, CRT | ✅ | `Establishment` (`regime` = CRT) |
| emit: endereço completo (logradouro, nº, bairro, CEP, município) | 🟡 | **não cadastrado** |
| emit: IE (inscrição estadual) | 🟡 | **não cadastrada** |
| dest: CPF/CNPJ, nome | ✅ | destinatário (documento opcional hoje — **confirmar se a operação exige**) |
| dest: endereço | ✅ parcial | rua, nº, bairro, cidade, UF, CEP |
| dest: cMun (código IBGE do município) | 🟡 | **guardamos só o nome da cidade**; precisa do código IBGE |
| dest: indIEDest, IE | 🔷 🟡 | contribuinte de ICMS? (pessoa física: não contribuinte) |
| det/prod: xProd, qCom, vUnCom, vProd | ✅ | guardados no pedido desde `f8ab6bd` |
| det/prod: cProd, uCom/uTrib (unidade), cEAN | 🟡 | código interno do produto e unidade (ex.: UN) — **definir** |
| det/prod: NCM, CFOP | ✅ 🔷 | parâmetros da regra |
| imposto: ICMS (CST/CSOSN + origem), PIS, COFINS | ✅ 🔷 | CST na regra; **bases e alíquotas, se o CST exigir, não estão na regra** |
| total (ICMSTot) | ⚙️ | soma dos itens |
| transp: modFrete | 🔷 🟡 | modalidade do frete (Correios/retirada) — **não definido** |
| pag: tPag, vPag | 🟡 | forma de pagamento — **não coletada** |
| infAdic: infCpl | ✅ 🔷 | parâmetro opcional da regra (ex.: referência à NFS-e) |

## DPS / NFS-e nacional (serviço fotográfico)

| Grupo / campo | Situação | Observação |
|---|---|---|
| Id, série, nDPS | ✅ ⚙️ | `dps-id.ts`, `numbering.ts` |
| tpAmb, dhEmi, dCompet | ✅ ⚙️ | competência = data do serviço? **confirmar** (hoje não coletamos a data do serviço) |
| cLocEmi (município emissor) | ✅ | `Establishment.municipioIbge` |
| prest: CNPJ | ✅ | |
| prest: IM (inscrição municipal), regime (opSimpNac, regEspTrib) | 🟡 🔷 | **não cadastrados** |
| toma: CPF/CNPJ, nome, e-mail | ✅ | tomador |
| toma: endereço | 🟡 | **não coletado** do tomador (só do destinatário) — confirmar se o município exige |
| serv: local da prestação (cLocPrestacao) | 🟡 🔷 | onde o ensaio aconteceu — **não coletado** |
| serv: cTribNac, cTribMun | ✅ 🔷 | parâmetros da regra |
| serv: xDescServ | ✅ | guardado no pedido desde `f8ab6bd` |
| serv: código NBS | 🔷 | **não está na regra** — confirmar obrigatoriedade |
| valores: vServ | ✅ | |
| valores: tribISSQN, tpRetISSQN, pAliq | ✅ 🔷 | retenção e alíquota na regra; **tributação do ISSQN (tribISSQN) não está na regra** |
| valores: totTrib (tributos aproximados) | 🔷 | regra de exibição — confirmar |

## O que fazer (proposta, em ordem)

1. **Cadastro do estabelecimento (ADMIN):** endereço completo, IE, IM, regime especial. Sem decisão fiscal, só dados da empresa.
2. **Código IBGE do município do destinatário:** escolher a cidade de uma lista pela UF (tabela pública do IBGE embarcada no sistema), em vez de texto livre. Evita consultar serviço externo com dados do cliente.
3. **Pedido:** forma de pagamento, data e local do serviço.
4. **Regra fiscal (responsável fiscal + contador):** acrescentar à regra os campos 🔷 que faltam — indFinal, indPres, finNFe, modFrete, indIEDest, bases/alíquotas conforme o CST, tribISSQN, NBS, totTrib — **sem valores padrão**, como os demais.
5. Só então escrever os montadores de XML, validando contra o XSD oficial.
