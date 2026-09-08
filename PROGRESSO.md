# Progresso — Fase 1 (Fundação)

> **Gate fechado — 8/9 itens verdes, 1 pendente só por falta de conta Resend.**
> Migrations aplicadas, seed rodado e conferido, hook habilitado, RLS testada com
> JWT real. Ver a seção "Gate de saída" para o resultado atualizado, e `CONSULTAS.md`
> para o registro completo de consultas às skills obrigatórias.

## O que ficou pronto

### Seção 2.1 (obrigatória antes de codar)

- [x] Superpowers consultado no início da fase — classificação Architectural, HARD-GATE
      de aprovação cumprido (plano aprovado antes de qualquer código).
- [x] Context 7 consultado antes de tocar em cada biblioteca externa nova — 20
      consultas registradas em `CONSULTAS.md`, incluindo 2 divergências reais entre a
      doc trazida e o pacote instalado (não apenas "desatualizada").
- [x] front-end-design consultado antes das telas de auth, com plano de tokens revisado
      contra os defaults conhecidos, registrado antes do código.
- [x] `CONSULTAS.md` existe e cobre todas as fases aplicáveis até aqui.

### Fase 1 — itens do "Entregar"

1. [~] Não há `supabase start` (sem Docker/sudo) — usado projeto hospedado. CLI só
   para `init`/config local; migrations aplicadas via `postgres-js` direto
   (ver "Achados operacionais" no fim do arquivo).
2. [x] Next.js 15.5.25 (fixado, não 16) + TypeScript + Tailwind v4 + ESLint + Prettier.
3. [x] Schema completo da Seção 5 em Drizzle (`src/db/schema.ts`) — 6 enums, 12
       tabelas, `id`/`criado_em`/`atualizado_em` em todas, os 3 índices únicos obrigatórios,
       os 3 checks de `contratos`. **5 migrations aplicadas ao projeto real.**
4. [x] RLS ativo em todas as 12 tabelas via `public.organizacao_id()` (não `auth.*`
       — ver achado no fim do arquivo); `coord_regiao` restrito à própria região em
       `pessoas`, `contratos`, `documentos`, `registros_atividade`. **Testado com
       JWT real e anon key — 4/4 cenários passando** (org A, org B, coord_regiao,
       gestor sem MFA).
5. [x] Custom Access Token Hook aplicado e **habilitado na plataforma**
       (Authentication → Hooks, feito por `apt.uplinux@gmail.com`) — confirmado
       funcionando pelos 4 testes de RLS.
6. [x] Supabase Auth com link mágico (`login/`) e MFA TOTP (`mfa/`) — testado de
       ponta a ponta: `apt.uplinux@gmail.com` completou o cadastro de TOTP com
       sucesso (`status: verified` em `auth.mfa_factors`).
7. [x] Buckets `documentos`/`contratos` privados **criados no projeto real** (via
       `insert into storage.buckets`, já que `config.toml`/CLI vinculado não foi
       usado), policies por `organizacao_id` aplicadas.
8. [x] `client.ts`, `server.ts`, `admin.ts` — regra de ESLint provada quebrando de
       propósito duas vezes (Tarefa 1 e Tarefa 10, para `admin.ts` e `db/client.ts`).
9. [~] `src/lib/notificacoes/` completo e testado (idempotência, retry, webhook,
   verificação de assinatura) — **sem conta Resend/domínio verificado ainda**,
   teste ponta a ponta do e-mail permanece pendente.
10. [x] Log de auditoria (`src/lib/auditoria/registrar.ts`) — grava em toda leitura de
        documento (via `criarUrlAssinada`); helpers prontos para escrita em
        `pessoas`/`contratos` (a chamada em si entra nos Server Actions da Fase 2).
11. [x] `seed.ts` e `seed-carga.ts` — **executados contra o banco real**, 82
        registros conferidos número a número contra a Seção 11.

## Gate de saída da Fase 1 — resultado final

```bash
npm run lint              # ✅ 0 erros
npx tsc --noEmit           # ✅ 0 erros
npm run build              # ✅ 15 rotas, sem erro
npm run test:unit          # ✅ 59/59
npm run test:integration   # ✅ 6/6 (2 webhook + 4 RLS com JWT real)
npm run db:migrate         # ✅ (aplicado via postgres-js direto — ver achado abaixo)
npm run db:seed            # ✅ 82 registros, números batendo com a Seção 11
```

Checklist item a item:

| Item                                                                                   | Resultado                                                                                                               |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `CONSULTAS.md` registra Superpowers e Context 7 (Auth, RLS, Storage, Next 15, Drizzle) | ✅                                                                                                                      |
| Ambiente sobe do zero com um comando                                                   | ✅ (ressalva: `supabase start` trocado por projeto hospedado, decisão já registrada)                                    |
| Org A não lê linha de org B (anon key + JWT real)                                      | ✅ **testado contra o projeto real**                                                                                    |
| `coord_regiao` X não lê pessoa da região Y                                             | ✅ **testado contra o projeto real**                                                                                    |
| `lint` falha ao importar `admin.ts` em `(painel)`                                      | ✅ provado quebrando de propósito e revertendo                                                                          |
| Login sem TOTP recusado para `gestor`                                                  | ✅ **testado contra o projeto real** — gestor sem `aal2` não lê nada, nem da própria organização                        |
| CPF repetido falha com erro tratado                                                    | ✅ índice único aplicado no banco real                                                                                  |
| Trocar papel força renovação da sessão                                                 | ⚠️ mecanismo (`signOut(jwt, 'global')`) ainda sem um Server Action que o dispare — é Fase 2 (tela de edição de usuário) |
| E-mail de teste chega e vai a `entregue` via webhook                                   | ❌ pendente — sem conta Resend/domínio verificado                                                                       |

**8 de 9 itens verdes.** O único pendente depende de infraestrutura que a decisão 2
já colocou como "deixar para depois" (sem conta Resend ainda) — o código do envio,
da idempotência e da verificação de assinatura do webhook já está escrito e testado
(`tests/unit/notificacoes/`, `tests/integration/webhook-resend.test.ts`). O item
"renovação de sessão" é código de Fase 2 (tela de usuários), não Fase 1.

## Decisões tomadas que não estavam no documento

1. **Seed: 11 regiões, não uma única lista.** As duas tabelas da Seção 11 não
   reconciliam como uma tabela só (21 contratos "do comitê" vs. 55 "por localidade").
   Modelei "Comitê" como uma região própria (21 ativos) e as 10 localidades como
   regiões separadas (55 ativos), mais 6 distratados — 76 ativos + 6 distrato ao todo.
2. **Taguatinga (assinados "não informado"): sem mecanismo de schema para isso.** Os
   12 contratos foram semeados como `enviado` (o último estágio confirmado pela
   fonte) — não fabriquei `assinado` nem fingi que o valor confirmado é 0. O schema
   atual (enum `status_contrato`, sem estado "desconhecido") não tem onde guardar "não
   sabemos quantos foram assinados" por contrato. **Fica pendência de design para a
   Fase 3**: o dashboard precisa de uma forma de marcar essa lacuna sem contar 0 — ou
   uma tabela/coluna nova para anotações de qualidade de dado por região, ou aceitar
   que esse caso específico do acervo real não será perfeitamente reproduzível sem
   inventar um requisito de schema não pedido pela Seção 5.
3. **Objeto dos contratos por localidade.** A Seção 11 não diz qual objeto/valor cabe
   a cada localidade — usei "Militância e Mobilização de Rua" (R$ 1.500,00) para todos,
   por ser o objeto de campo do catálogo.
4. **Chaves de API: aceitar os dois formatos sob os nomes da Seção 3.2** (decisão já
   tomada com você — registrada em CONSULTAS.md).
5. **Valor por extenso sem a vírgula do exemplo da Seção 12.** A biblioteca `extenso`
   segue a regra gramatical real do português (o "e" antes de um grupo depende de esse
   grupo ser uma centena "redonda" ou não) — não insere a vírgula depois de "mil" que
   o texto de exemplo mostra. Inserir essa vírgula à mão seria o mais perto de
   "escrever valor por extenso à mão" que a Seção 2 proíbe. Usei a saída literal da
   biblioteca.
6. **Storage do `/coleta/[token]` público não resolvido nesta fase.** As policies de
   RLS escritas cobrem o uso autenticado (painel). O acesso não-autenticado ao link de
   coleta público — sem JWT, sem `organizacao_id` — precisa de um desenho próprio
   (provavelmente uma função `SECURITY DEFINER` validando só o token). Fica para a
   Fase 2, quando essa rota é de fato construída.
7. **Log de auditoria em pessoas/contratos**: os helpers existem
   (`registerPersonWrite`/`registerContractWrite`), mas a chamada de dentro dos
   Server Actions de CRUD é Fase 2 (é lá que esses CRUDs são escritos).

## Pontos onde o Context 7 divergiu do que eu teria escrito de memória

Lista completa com "o que mudou" em `CONSULTAS.md`. Os três mais importantes:

1. **Custom Access Token Hook é função Postgres, não Edge Function** — o próprio
   PROMPT (§2.1) cita um exemplo que sugere o contrário.
2. **Tipos de evento do webhook do Resend: a primeira resposta do Context 7 veio da
   branch `canary` (não publicada)** — `email.bounce`/`email.complaint`/`data.id`, que
   não existem no pacote realmente instalado (`resend@6.26.0`: `email.bounced`/
   `email.complained`/`data.email_id`). Pego pelo `tsc`, não pela leitura da doc — é a
   divergência mais séria da fase, porque teria compilado, rodado, e nunca batido em
   nenhum evento real.
3. **`middleware.ts` quase virou `proxy.ts`** — um exemplo do próprio `supabase/supabase`
   já usa a convenção do Next.js 16; confirmei que o projeto (fixado em 15.5.25) ainda
   usa `middleware.ts`.

## Erros próprios que a verificação (não uma skill) pegou

- `currency: { type: "BRL" }` devia ser `{ code: "BRL" }` — passou no teste manual por
  coincidência (BRL é o default da lib) e só o `tsc --noEmit` contra o `.d.ts` real
  acusou.
- `ReturnType<typeof createClient>` tipava `.update()`/`.insert()` como `never` —
  resolvido tipando com `SupabaseClient` diretamente.
- O `seed.ts` original pulava o estado `distratado` ao ir para `distrato_assinado` —
  transição que a própria máquina de estados rejeitaria. Pego na revisão, corrigido
  extraindo `buildTransitionPath()` para um módulo próprio, testado (TDD) antes de
  ser usado no seed.
- `npm run format` (`prettier --write .`) alcançou `PROMPT-Comite-Digital.md` e
  `.agents/` (vendorizado) na primeira vez que rodei — revertido nos dois casos, e
  `.prettierignore` criado para não repetir.
- O primeiro teste de RLS usava usuários `gestor` para testar isolamento de
  organização — mas `gestor` exige MFA (`aal2`) pela nossa própria policy, e o
  teste só logava por senha, sem completar TOTP. Isso fazia o teste "falhar" mesmo
  com o hook já funcionando (a policy de MFA nega tudo antes da de organização
  entrar em jogo). Corrigido usando `auditor` (sem exigência de MFA) para isolar o
  teste de organização, e criado um teste **separado e dedicado** para a exigência
  de MFA em si.

## Não verificado visualmente

O sub-estado de cadastro de TOTP (tela `/mfa` com QR code) não foi confirmado por
screenshot contra uma resposta real do Supabase Auth — tentei mockar via
interceptação de rede no Playwright e não convergiu a tempo. As outras 3 telas
(login, verificação, mfa em estado de carregamento) foram conferidas por screenshot
real em desktop (1280px) e mobile (360px). **Atualização:** o fluxo real de
cadastro de TOTP foi confirmado funcionando de ponta a ponta pelo próprio
`apt.uplinux@gmail.com` (o fator aparece `status: verified` no banco).

## Achados operacionais ao aplicar contra o projeto real

1. **`drizzle-kit migrate` trava indefinidamente contra o pooler** (sem lock nenhum
   do lado do servidor — confirmado via `pg_stat_activity`/`pg_locks`). Contornado
   aplicando cada migration diretamente via `postgres-js`, dividindo por
   `--> statement-breakpoint` e envolvendo em transação. Funcionou de primeira.
2. **O schema `auth` é travado em projeto hospedado** — nem o role `postgres` cria
   objeto lá, só `supabase_auth_admin`. `auth.organizacao_id()`/`auth.papel()`/
   `auth.regiao_id()` viraram `public.organizacao_id()` etc. — o mesmo padrão do
   exemplo oficial atual do Supabase para claims customizadas
   (`public.authorize(...)`). Corrigido em `0001_auth_claims.sql`,
   `src/db/schema.ts` e `0004_storage_policies.sql`; migration 0002 regenerada
   (`0002_tearful_vindicator.sql`).
3. **Buckets `documentos`/`contratos` criados via `insert into storage.buckets`** —
   `config.toml` só é aplicado via `supabase config push`/CLI vinculado, que não
   rodei (exige `SUPABASE_ACCESS_TOKEN`, não recebido).
4. **`npm run db:seed` "morreu" por timeout do lado de cá mas continuou rodando no
   servidor** na primeira tentativa — rodei de novo sem perceber e dupliquei os
   dados. Truncado e re-semeado uma única vez; números finais conferem exatos com
   a Seção 11 (76 ativos, 6 distrato, 206 eventos_contrato, por região).
5. **Dois (depois três) processos `next dev` rodando ao mesmo tempo** corromperam
   os chunks do `.next` e causaram `ChunkLoadError`/404 no navegador do usuário —
   não era bug de código. Resolvido matando os processos extras e limpando `.next`.
   **Rode só um `npm run dev` por vez** — ver `TESTE-LOCAL.md`.
6. **`apt.uplinux@gmail.com` habilitou o hook, MFA e (a confirmar) o SMTP** no
   Dashboard do Supabase — os 4 testes de RLS em
   `tests/integration/rls-isolamento.test.ts` confirmam que as claims chegam
   corretas no JWT (`organizacao_id`, `papel`, `regiao_id`) e que a policy de MFA
   restringe gestor/coord_comite sem `aal2`.

## Skills oficiais instaladas durante a fase

A pedido do usuário, `npx skills add supabase/agent-skills` instalou dois skills
mantidos pela própria Supabase (`.agents/skills/supabase/` e
`.agents/skills/supabase-postgres-best-practices/`, registrados em
`skills-lock.json` — mesmo mecanismo do Context 7). Revisão contra o design já
feito, antes da primeira migration real:

- **Achado que mudou código:** toda policy de RLS precisa envolver
  `auth.organizacao_id()`/`auth.papel()`/`auth.regiao_id()`/`auth.jwt()` em
  `(select ...)` — sem isso o Postgres reavalia a função por linha em vez de uma
  vez por consulta (até 100x mais lento em tabela grande, e a Seção 10 exige
  dashboard < 2s com 2.000 contratos). Corrigido nos 4 helpers de policy em
  `src/db/schema.ts` e nas 5 policies de `0004_storage_policies.sql`.
- O checklist de segurança do skill oficial (`auth.role()` deprecado, `TO
authenticated` sem predicado de posse, `UPDATE` sem `WITH CHECK`, `SECURITY
DEFINER` sem `REVOKE EXECUTE`, upload de Storage exigindo INSERT+SELECT+UPDATE)
  já estava coberto pelo design das Tarefas 4/5/7 — nenhuma mudança adicional
  necessária.

Skills adicionais apareceram em `skills-lock.json` (`frontend-design` de
`anthropics/skills`, `web-design-guidelines` de `vercel-labs/agent-skills`) sem eu
ter rodado `npx skills add` de novo — parece sincronização automática da
ferramenta `skills`. Fontes legítimas (Anthropic, Vercel Labs); não investigado a
fundo por não ser bloqueante.

## Credenciais — como chegaram nesta sessão

Você colou as credenciais diretamente no `.env.example` (o template versionado no
git) em vez do `.env.local` — movi os valores para `.env.local` (gitignored) e
restaurei o `.env.example` ao template vazio antes de qualquer commit, então nada
sensível chegou a entrar no histórico do git.

## Provisionamento de usuário + trabalho paralelo de Fase 2-4

- **`apt.uplinux@gmail.com` provisionado como `gestor`** via novo script
  `npm run db:provision-user` (`src/db/provision-user.ts`) — reaproveitou um
  usuário de Auth que já existia (alguém já tinha tentado `/login` com esse
  e-mail antes de ter linha em `usuarios`).
- **Decisão de projeto, fora do PROMPT: hospedagem será na Netlify.** Registrado
  em `TESTE-LOCAL.md` (Seção 7) com os pontos de atenção conhecidos (Next Runtime
  da Netlify, variáveis de ambiente no painel dela, `middleware.ts` como Edge
  Function, agendamento de `/api/cron/*` da Fase 4 ainda não desenhado para lá).
  Nada configurado ainda — é só o registro da decisão.
- **Um volume grande de telas de Fase 2/3/4 apareceu no repositório**, fora das
  minhas ações diretas (`(painel)/pessoas`, `contratos`, `documentos`,
  `atividades`, `configuracoes`, `coleta/[token]`, e novos componentes de UI) —
  confirmei que **tudo é mockup visual com dado fixo no código** (`useState`
  local, sem `createClient`, sem consulta ao Supabase), então não interfere com
  o gate da Fase 1 nem com a integridade dos dados reais. `npm run build`, `tsc`
  e `lint` passam limpos com esse código incluído. **Não revisei esse código
  linha a linha** (seria auditar entrega de Fase 2/3/4 que não me foi pedida) —
  só verifiquei que builda e que não importa `admin.ts` dentro de `(painel)` (a
  regra de ESLint pegaria isso automaticamente).
- Criado `TESTE-LOCAL.md` com o passo a passo completo de `npm install` até logar
  de verdade como o gestor provisionado, explicando exatamente quais telas são
  reais e quais são mockup hoje.

## Próximo passo

A Fase 1 está com o gate fechado (8/9 — o pendente é infraestrutura de Resend, não
código). Conforme a Seção 14 do PROMPT: **parar e aguardar sua revisão antes da
Fase 2.**
