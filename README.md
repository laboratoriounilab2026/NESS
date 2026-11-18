# NESS

Emissor próprio para preparar, revisar, emitir e acompanhar, a partir de **um pedido**, as duas notas de uma venda de fotografia:
a **NFS-e** do serviço fotográfico e a **NF-e** do álbum que acompanha a encomenda.

> **Situação:** a transmissão ao governo ainda não está ligada (homologação depende de certificado A1, CNPJ e regras fiscais aprovadas).
> Pedidos, regras, revisão e acompanhamento já funcionam; ao emitir, o sistema explica que nada foi enviado.

## Stack

Next.js 16 (App Router), React 19, TypeScript estrito, Tailwind 4, Prisma 7 + PostgreSQL, Vitest, Playwright (só no CI).

## Rodando localmente

```bash
npm install
npx prisma dev -n ness -d          # Postgres local embutido; copie a URL para .env.local como DATABASE_URL
npx prisma migrate deploy
npm run user:create -- voce@empresa.com "Seu Nome" ADMIN   # senha digitada sem eco
npm run dev
```

`.env.local` fica fora do Git. Com o `prisma dev`, use também `DATABASE_POOL_MAX=1`.

## Comandos

| Comando | Para quê |
|---|---|
| `npm run verify` | lint + tipos + testes (roda também no `pre-push`) |
| `npm run build` | build de produção |
| `npm run user:create` / `user:password` / `user:disable` / `user:enable` | gestão de contas pelo terminal |
| `npm run customers:merge` | lista clientes duplicados; `-- --apply` funde (irreversível) |

## Documentação

- [docs/GUIA_DE_USO.md](docs/GUIA_DE_USO.md): uso por papel (operador, fiscal, administrador)
- [docs/ARQUITETURA.md](docs/ARQUITETURA.md): contratos, estados, idempotência, reconciliação, numeração
- [docs/PLANO_NESS.md](docs/PLANO_NESS.md): plano e situação das fases
- [docs/PERGUNTAS_CONTADOR.md](docs/PERGUNTAS_CONTADOR.md): perguntas fiscais para o contador (pendências da emissão)
- [CLAUDE.md](CLAUDE.md): regras do projeto (fiscais, segurança, UI) e notas de ambiente

## Regras que não mudam

Nenhum parâmetro fiscal (CFOP, CST, NCM, alíquota…) vem do código: só de regra aprovada e vigente pelo responsável fiscal.
Nenhuma nota é dada como autorizada sem confirmação do governo. Sem resposta, a nota fica "aguardando confirmação" e é consultada antes de qualquer reenvio.
