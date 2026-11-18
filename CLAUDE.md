# NESS — Diretrizes do projeto

## Missão
Implementar o NESS, emissor próprio confiável para preparar, revisar, emitir e acompanhar, a partir de um pedido único, a NFS-e do serviço fotográfico e a NF-e relacionada ao álbum/mercadoria, respeitando as regras aprovadas para o estabelecimento e a operação.

## Antes de alterar
- Inspecione o repositório, package manifests, arquitetura, banco, rotas, autenticação, design system e emissores existentes.
- Identifique tecnologias e padrões reais. Não substitua stack nem recrie módulos existentes sem justificativa.
- Faça um mapa de integração dos emissores NFS-e e NF-e atuais.
- Apresente plano, arquivos afetados, riscos, migrações e testes antes de mudanças estruturais.
- Preserve funcionalidades existentes e mantenha alterações pequenas, revisáveis e incrementais.

## Regras fiscais invioláveis
- Não invente CFOP, CST/CSOSN, NCM, alíquota, código municipal, retenção, natureza de operação ou tratamento tributário.
- Não generalize orientação de uma UF/município/regime para outro.
- Somente matriz fiscal aprovada por profissional responsável pode habilitar um cenário.
- Cenário sem regra ativa e vigente deve ser bloqueado, com explicação e encaminhamento administrativo.
- O operador não deve preencher parâmetros fiscais técnicos.
- Separar tomador do serviço e destinatário físico da encomenda.
- A autorização da NFS-e e da NF-e é independente; representar sucesso parcial.
- Nunca afirmar que um documento foi autorizado sem confirmação confiável do emissor/provedor.

## Segurança e confiabilidade
- Certificados, senhas, tokens e dados pessoais nunca devem aparecer em logs, commits, fixtures ou respostas de erro.
- Segredos apenas em secret manager/variáveis seguras existentes; nunca criar valores fictícios que pareçam reais.
- Emissão deve ser idempotente por pedido + tipo de documento + operação/tentativa controlada.
- Timeout não significa rejeição nem autorização: reconciliar consultando o emissor antes de reenviar.
- Toda mudança de configuração fiscal deve ter autoria, data, justificativa e vigência.
- Ações irreversíveis exigem confirmação explícita e autorização adequada.
- Aplicar menor privilégio, validação server-side e trilha de auditoria.

## Experiência e interface
- Interface premium, profissional, clara e consistente; sem aparência genérica de template.
- Construir primeiro arquitetura da informação e hierarquia; depois tokens, componentes e telas.
- Incluir hero section útil no dashboard, navegação lateral, cards informativos, estados visuais, feedback, skeletons e empty states.
- Usar ícones de uma única família/estilo. Flaticon somente com licença compatível e atribuição quando exigida; não raspar nem baixar em massa.
- Se Flaticon não estiver licenciado, usar biblioteca já existente no projeto ou Lucide como fallback.
- Acessibilidade WCAG 2.1 AA como meta: contraste, foco, teclado, labels, mensagens e estados não dependentes só de cor.
- Suportar tema claro/escuro se compatível com a arquitetura atual; persistência deve seguir o padrão já usado pelo produto.
- Respeitar prefers-reduced-motion e evitar animações que atrapalhem operação fiscal.

## Engenharia
- Tipagem estrita quando suportada pela stack.
- Validar dados no cliente e novamente no servidor.
- Não colocar regras fiscais críticas apenas no frontend.
- Não duplicar fonte de verdade de clientes, serviços, produtos, pedidos ou documentos.
- Testes unitários para domínio, integração para adaptadores, E2E para jornada e testes de falhas parciais.
- Não declarar tarefa concluída sem executar verificações relevantes e reportar o resultado real.

## Comunicação
- Trabalhe em português brasileiro.
- Diferencie fatos encontrados no código, decisões propostas e pontos que dependem de validação humana.
- Quando faltar informação fiscal, interrompa o cenário e registre a pendência; não improvise.

## Skills e agents de terceiros
Instaladas em `.claude/` (ver `docs/SKILLS_INSTALADAS.md`). Em caso de conflito, este `CLAUDE.md` e `.claude/rules/*` prevalecem sobre qualquer skill/agent externo. Hooks de terceiros não foram instalados.

## Stack e comandos (Fase 0)
Next.js 16 (App Router, `src/`), React 19, TypeScript estrito, Tailwind 4, lucide-react. Leia `AGENTS.md`: Next 16 tem mudanças (params assíncronos, `proxy` no lugar de `middleware`).
- `npm run dev` · `npm run lint` · `npm run typecheck` · `npm run build` (CI: `.github/workflows/ci.yml`).
- Tokens de design em `src/app/globals.css` (direção "Mosaico", tela 10); use só os tokens (`bg-surface`, `text-muted`, `text-ok`…), nunca cores soltas.
- Status sempre com `StatusBadge` (ícone + texto). Itens de menu sem rota aparecem como "em breve".
- Fase 1: estados em `src/domain/states.ts` (fonte única, testes em `npm test`); schema em `prisma/schema.prisma` (Prisma 7.10.1 estável — a tag `latest` do npm aponta para rc, não usar). `npm run db:generate` / `npm run db:migrate` (precisa `DATABASE_URL` em `.env.local`).
- Banco local sem instalação: `npx prisma dev -n ness -d` (Postgres embutido, porta 51214; URL em `.env.local`, fora do git). Testes de integração (`*.test.ts` que usam `@/lib/db`) rodam só com `DATABASE_URL`; no CI são pulados.
- Login: e-mail+senha (scrypt, `src/auth/`), sessão em tabela `Session` (só hash do token), papéis OPERADOR/FISCAL/ADMIN. `src/proxy.ts` só checa o cookie; toda página/ação com dados chama `requireUser(...)`. Criar usuário: `npm run user:create -- email "Nome" ADMIN` (senha digitada sem eco).
- Migrações: o Prisma recusa `migrate reset` vindo de IA; não contornar. Se o shadow DB travar, gerar com `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script` e aplicar com `migrate deploy` (nome da pasta em UTC, depois da última).
- Configuração fiscal: ADMIN cadastra estabelecimento (sempre HOMOLOGACAO); FISCAL cria regra (versão automática por escopo) e aprova com confirmação; regra aprovada é imutável (alterar = nova versão). Campos validam só formato (`src/fiscal/rule-input.ts`), sem valores padrão.
- `prisma dev` local: se travar com "Lock file is already being held", rode `npx prisma dev stop ness`, espere ~10s e suba de novo. Testes com banco rodam com `fileParallelism: false`.
- Fase 6: `src/orchestrator/emit.ts` (emitDocument/reconcileDocument/emitOrder) sobre o contrato `src/emitters/types.ts`. Timeout/erro de rede → INCERTO; só sai por consulta. Emissor falso existe só nos testes; nunca ligar à interface (não pode exibir "Autorizada" sem emissor real).
- `.env.local` local usa `DATABASE_POOL_MAX=1` (o `prisma dev` aceita uma conexão por vez). Máquina com pouca RAM: se o Vitest cair ao iniciar, rode `npx vitest run --maxWorkers=1`. `npm test` passa por `scripts/vitest.mjs` (normaliza o drive `c:`→`C:`; sem isso o Vitest falha no Git Bash com "reading 'config'"). `src/test/setup.ts` fecha a conexão ao fim de cada arquivo (sem isso o `prisma dev` travava após 2–3 rodadas com "Connection terminated"); se ainda travar, reinicie-o.
- Gate: `npm run verify` (lint + tipos + testes). O hook `.githooks/pre-push` roda o verify e bloqueia push com falha (ativado por `npm install` via `prepare`). Nunca encadear commit/push no mesmo comando dos testes.
- Emissão pela interface: `src/emitters/registry.ts` (`getAdapter`) é o único ponto de ligação; hoje devolve `null` e o envio é bloqueado com explicação. Fases 4/5 registram ali os adaptadores reais. Testes trocam o registro via `vi.mock`.
- E2E (Fase 8): `e2e/journey.spec.ts` + `playwright.config.ts`; roda só no CI (job `e2e`: Postgres de serviço, `migrate deploy`, testes de integração, `node e2e/seed.ts` com `E2E_PASSWORD` aleatória por execução, chromium). Não instalar navegador localmente (pouca RAM). Seed cria estabelecimento fictício: nunca rodar contra o banco de dev.
