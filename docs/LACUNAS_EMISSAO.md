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
| ide: indFinal, indPres, finNFe | ✅ 🔷 | campos da regra (listas do layout, sem padrão) |
| emit: CNPJ, razão social, CRT | ✅ | `Establishment` (`regime` = CRT) |
| emit: endereço completo (logradouro, nº, bairro, CEP, município) | ✅ | cadastro da empresa (ADMIN) |
| emit: IE (inscrição estadual) | ✅ | cadastro da empresa (só formato: dígitos ou ISENTO) |
| dest: CPF/CNPJ, nome | ✅ | destinatário (documento opcional hoje — **confirmar se a operação exige**) |
| dest: endereço | ✅ parcial | rua, nº, bairro, cidade, UF, CEP |
| dest: cMun (código IBGE do município) | ✅ | cidade validada contra a tabela do IBGE embarcada (`src/domain/municipios.ts`); código gravado em `Recipient.cityIbge` |
| dest: indIEDest | ✅ 🔷 | campo da regra (lista do layout) |
| dest: IE do destinatário | 🟡 | só se contribuinte; **não coletada** (estúdio vende a pessoa física na maioria dos casos) |
| det/prod: xProd, qCom, vUnCom, vProd | ✅ | guardados no pedido desde `f8ab6bd` |
| det/prod: cProd, uCom/uTrib (unidade), cEAN | 🟡 | código interno do produto e unidade (ex.: UN) — **definir** |
| det/prod: NCM, CFOP | ✅ 🔷 | parâmetros da regra |
| imposto: ICMS (CST/CSOSN + origem), PIS, COFINS | ✅ 🔷 | CST na regra; **bases e alíquotas, se o CST exigir, não estão na regra** |
| total (ICMSTot) | ⚙️ | soma dos itens |
| transp: modFrete | ✅ 🔷 | campo da regra (lista do layout) |
| pag: tPag, vPag | ✅ | forma de pagamento no pedido (códigos tPag usuais; conferir tabela vigente) |
| infAdic: infCpl | ✅ 🔷 | parâmetro opcional da regra (ex.: referência à NFS-e) |

## DPS / NFS-e nacional (serviço fotográfico)

| Grupo / campo | Situação | Observação |
|---|---|---|
| Id, série, nDPS | ✅ ⚙️ | `dps-id.ts`, `numbering.ts` |
| tpAmb, dhEmi, dCompet | ✅ ⚙️ | data do serviço coletada no pedido (competência) — confirmar com o contador se competência = data do serviço |
| cLocEmi (município emissor) | ✅ | `Establishment.municipioIbge` |
| prest: CNPJ | ✅ | |
| prest: IM (inscrição municipal) | ✅ | cadastro da empresa |
| prest: regime (opSimpNac, regEspTrib) | ✅ 🔷 | campos da regra (código digitado conforme o manual) |
| toma: CPF/CNPJ, nome, e-mail | ✅ | tomador |
| toma: endereço | 🟡 | **não coletado** do tomador (só do destinatário) — confirmar se o município exige |
| serv: local da prestação (cLocPrestacao) | ✅ | município do serviço no pedido, validado pelo IBGE |
| serv: cTribNac, cTribMun | ✅ 🔷 | parâmetros da regra |
| serv: xDescServ | ✅ | guardado no pedido desde `f8ab6bd` |
| serv: código NBS | ✅ 🔷 | campo opcional da regra (9 dígitos) — confirmar obrigatoriedade |
| valores: vServ | ✅ | |
| valores: tribISSQN, tpRetISSQN, pAliq | ✅ 🔷 | campos da regra |
| valores: totTrib (tributos aproximados) | 🔷 | regra de exibição — confirmar |

## O que fazer (proposta, em ordem)

1. ~~**Cadastro do estabelecimento (ADMIN):** endereço completo, IE, IM~~ — feito. Regime especial (regEspTrib) é decisão fiscal: vai para a regra.
2. ~~**Código IBGE do município do destinatário**~~ — feito: lista por UF com a tabela pública do IBGE embarcada (sem consulta externa com dados do cliente).
3. ~~**Pedido:** forma de pagamento, data e local do serviço~~ — feito.
4. ~~**Regra fiscal:** indFinal, indPres, finNFe, modFrete, indIEDest, tribISSQN, opSimpNac, regEspTrib, NBS~~ — campos acrescentados, sem padrão. **Ainda faltam:** bases/alíquotas de ICMS/PIS/COFINS quando o CST exigir e totTrib — dependem de quais CST o contador vai usar. Regras aprovadas antes destes campos não os têm: criar nova versão.
5. Só então escrever os montadores de XML, validando contra o XSD oficial.
