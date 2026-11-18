# Lacunas para montar o XML da NF-e e da DPS

Levantamento de **quais dados as notas exigem e o NESS ainda não tem**, feito antes de escrever os XMLs (Fases 4/5).
Os grupos e campos vêm do layout da NF-e 4.00 e da DPS nacional, de memória técnica: **conferir cada item contra o
Manual de Orientação do Contribuinte (NF-e) e o XSD/manual vigente da NFS-e nacional** antes de implementar.
Nenhum valor fiscal é sugerido aqui: onde o campo é decisão tributária, ele vai para a **regra fiscal aprovada**.

Legenda: ✅ já existe · 🟡 falta no cadastro (dado operacional) · 🔷 decisão fiscal (regra aprovada pelo contador) · ⚙️ o sistema calcula

## ⚠️ Reforma Tributária (IBS/CBS) — prioridade, depende do contador

Este levantamento foi feito pelo leiaute "clássico". A NFS-e nacional **já tem leiaute com IBS/CBS em produção desde
05/01/2026** (NT 004), e a documentação segue evoluindo (NT 009 v1.01, de 01/10/2026). Os anexos novos trazem o
**indicador de operação (cIndOp)** e a **classificação tributária (cClassTrib)**, com correlação por NBS (Anexo VIII,
que a própria página diz ainda não ter regras de negócio em produção). A NF-e também recebeu grupo de IBS/CBS pela reforma.

Antes de escrever os XMLs, o responsável fiscal/contador precisa definir, para o serviço fotográfico e para o álbum:
- se a emissão já deve seguir o leiaute RTC (com IBS/CBS) e qual versão das notas técnicas;
- cClassTrib, indicador de operação e CST de IBS/CBS aplicáveis, e as alíquotas do período;
- como fica o NBS do serviço (passa a ser relevante na correlação).

**O que a DPS pede ao emitente no grupo `IBSCBS`** (lido do Anexo VI v1.04.01 / NT 009, aba "LEIAUTE DPS_NFS-e - RT",
em 18/11/2026), para um serviço comum:

| Campo | Ocorrência | Formato | Descrição (do anexo) |
|---|---|---|---|
| `IBSCBS/indFinal` | 0-1 | 1 dígito | operação de uso ou consumo pessoal (0 = não, 1 = sim) |
| `IBSCBS/cIndOp` | 0-1 | 6 dígitos | código indicador da operação de fornecimento (tabela do Anexo VII) |
| `IBSCBS/valores/trib/CST` | 1-1 | 3 dígitos | Código de Situação Tributária do IBS e da CBS |
| `IBSCBS/valores/trib/cClassTrib` | 1-1 | 6 dígitos | Código de Classificação Tributária do IBS e da CBS |

Alíquotas, base e totais do IBS/CBS são **calculados pelo sistema nacional** na NFS-e (grupo `infNFSe/IBSCBS`), não informados
pelo emitente. Os demais subgrupos da DPS são de casos especiais (imóveis, condomínios, compras governamentais, doação,
diferimento, crédito presumido, notas de ajuste) — confirmar com o contador que não se aplicam ao estúdio.
Observação do anexo para o Simples Nacional: "os grupos IBSCBS só serão obrigatórios **a partir de 2027**".
(Correção: uma versão anterior deste documento dizia que o texto vinha truncado no arquivo oficial — o corte era da
ferramenta de leitura usada aqui, não do anexo.)

Outros pontos confirmados no mesmo anexo:
- **Id da DPS:** "DPS" + Cód. Mun. (7) + tipo de inscrição (1) + inscrição (14, CPF com zeros à esquerda) + série (5) + número (15) — igual ao implementado.
- **Série da DPS:** 00001 a 49999 é a faixa de **emissão por aplicativo próprio** (50000–69999 Emissor Móvel, 70000–79999 Emissor Web, 80000–89999 transcrição manual). O NESS passou a aceitar só 1–49999.
- **Campos clássicos da DPS** (prest, toma, cLocPrestacao, cTribNac 6, cTribMun 3, cNBS 9, xDescServ até 2000, tpRetISSQN) batem com o implementado. tribISSQN, opSimpNac e regEspTrib viraram listas com os rótulos do anexo; alíquota do ISS no formato 1V2 (até 9,99).
- **Novo, não previsto antes:** `prest/regTrib/regApTribSN` (opcional) — regime de apuração para optante ME/EPP que ultrapassou sublimite. Confirmar com o contador se se aplica.
- **dCompet:** "deve ser … a data da prestação do serviço" — é a data do serviço que o pedido já coleta.

Os quatro campos já existem na regra da NFS-e como **opcionais** (só formato, sem valor padrão): o responsável fiscal preenche quando o contador definir. Regras aprovadas antes deles continuam válidas. Fontes oficiais:
- Página RTC da NFS-e: https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/rtc
- Documentação técnica (manuais, leiautes, XSD): https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica

## NF-e (álbum)

Códigos de indFinal, indPres, finNFe, indIEDest e modFrete **conferidos no MOC online** (moc.sped.fazenda.pr.gov.br) em 18/11/2026; finNFe ganhou 5 (nota de crédito) e 6 (nota de débito) com a Reforma. O grupo UB (IBS/CBS) da NF-e — NT 2025.002, hoje na v1.53 (30/10/2026) — ainda precisa ser levantado para a regra, como na NFS-e.

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
| Id, série, nDPS | ✅ ⚙️ | `dps-id.ts` (composição confirmada no Anexo VI), `numbering.ts`; série 1–49999 (aplicativo próprio) |
| tpAmb, dhEmi, dCompet | ✅ ⚙️ | dCompet = data da prestação do serviço (confirmado no Anexo VI), coletada no pedido |
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
