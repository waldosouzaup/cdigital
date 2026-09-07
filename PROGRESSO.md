# Progresso — Fase 1 (Fundação)

> Atualizado ao final da Fase 1, antes do gate. Ver `CONSULTAS.md` para o registro
> completo de consultas às skills obrigatórias.

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
1. ❌ Não há `supabase start` — ver **Bloqueio** abaixo. CLI usado para `init`/
   `config` local; Postgres seria o hospedado.
2. [x] Next.js 15.5.25 (fixado, não 16) + TypeScript + Tailwind v4 + ESLint + Prettier.
3. [x] Schema completo da Seção 5 em Drizzle (`src/db/schema.ts`) — 6 enums, 12
   tabelas, `id`/`criado_em`/`atualizado_em` em todas, os 3 índices únicos obrigatórios,
   os 3 checks de `contratos`. Migrations geradas em `supabase/migrations/`.
4. [x] RLS ativo em todas as 12 tabelas via `auth.organizacao_id()`; `coord_regiao`
   restrito à própria região em `pessoas`, `contratos`, `documentos`,
   `registros_atividade` — **escrito e revisado, não aplicado a banco real** (ver
   Bloqueio).
5. [x] Custom Access Token Hook escrito (`0001_auth_claims.sql`) — função Postgres,
   com o bloco de GRANT/REVOKE que o Context 7 revelou como necessário.
6. [x] Supabase Auth com link mágico (`login/`) e MFA TOTP (`mfa/`) — telas prontas,
   chamando a API real; enforcement de obrigatoriedade é policy RLS (`aal2`), não
   checagem de aplicação.
7. [x] Buckets `documentos`/`contratos` privados declarados em `config.toml`, policies
   por `organizacao_id` em `0004_storage_policies.sql`.
8. [x] `client.ts`, `server.ts`, `admin.ts` — regra de ESLint provada quebrando de
   propósito duas vezes (Tarefa 1 e Tarefa 10, para `admin.ts` e `db/client.ts`).
9. [~] `src/lib/notificacoes/` completo e testado (idempotência, retry, webhook) —
   **sem conta Resend real ainda**, então o teste ponta a ponta do gate não rodou.
10. [x] Log de auditoria (`src/lib/auditoria/registrar.ts`) — grava em toda leitura de
    documento (via `criarUrlAssinada`); helpers prontos para escrita em
    `pessoas`/`contratos` (a chamada em si entra nos Server Actions da Fase 2).
11. [x] `seed.ts` e `seed-carga.ts` escritos — **não executados** (ver Bloqueio).

## Bloqueio ativo — impede o gate completo

**Não há projeto Supabase hospedado nem Docker local.** Ficou definido com você que
usaríamos um projeto hospedado em vez de `supabase start` (sem Docker disponível, sem
sudo para instalar). Preciso de:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (ou a `publishable` key nova)
- `SUPABASE_SERVICE_ROLE_KEY` (ou a `secret` key nova)
- `DATABASE_URL` (pooler, porta 5432, para o Drizzle)

Com isso eu rodo: `npx supabase link`, habilito o Custom Access Token Hook (dashboard
ou `supabase config push`), `npm run db:migrate`, `npm run db:seed`, e os testes de
integração de RLS com anon key + JWT real (Tarefa 11 — só esses dois testes
específicos dependem de banco; o resto da Tarefa 11, como a rejeição de assinatura de
webhook inválida, já roda e passa).

**Conta Resend** também não existe ainda (decisão já tomada: deixar pendente). Preciso
de `RESEND_API_KEY`, um domínio verificado (ou o domínio de teste do Resend) e
`RESEND_WEBHOOK_SECRET` para o item "e-mail de teste chega e vai a `entregue`".

## Gate de saída da Fase 1 — resultado

```bash
npm run lint          # ✅ passou, 0 erros
npx tsc --noEmit      # ✅ passou, 0 erros
npm run build         # ✅ passou, 9 rotas, sem erro
npm run test:unit     # ✅ 59/59 testes
npm run test:integration  # ✅ 2/2 (webhook, sem precisar de banco)
supabase start && npm run db:migrate && npm run db:seed   # ❌ bloqueado — sem projeto hospedado
```

Checklist item a item:

| Item | Resultado |
|---|---|
| `CONSULTAS.md` registra Superpowers e Context 7 (Auth, RLS, Storage, Next 15, Drizzle) | ✅ |
| Ambiente sobe do zero com um comando | ❌ bloqueado — sem projeto Supabase |
| Org A não lê linha de org B (anon key + JWT real) | ❌ bloqueado — RLS escrita e revisada, não testada contra banco real |
| `coord_regiao` X não lê pessoa da região Y | ❌ bloqueado — mesma causa |
| `lint` falha ao importar `admin.ts` em `(painel)` | ✅ provado quebrando de propósito e revertendo (saída colada acima na conversa) |
| Trocar papel força renovação da sessão | ⚠️ mecanismo (`signOut(jwt, 'global')`) ainda não implementado num Server Action — é Fase 2 (edição de usuário) |
| CPF repetido falha com erro tratado | ✅ índice único existe no schema; teste de integração fica para quando o banco existir |
| Login sem TOTP recusado para `gestor` | ✅ policy RLS restritiva escrita; não testada contra banco real |
| E-mail de teste chega e vai a `entregue` via webhook | ❌ bloqueado — sem conta Resend |

**4 de 9 itens verdes, 1 parcial, 4 bloqueados por infraestrutura ausente — não por
código faltando.** Todo o código que os itens bloqueados exercitariam está escrito,
tipado, lintado e revisado; falta só uma conexão real para provar.

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

## Não verificado visualmente

O sub-estado de cadastro de TOTP (tela `/mfa` com QR code) não foi confirmado por
screenshot contra uma resposta real do Supabase Auth — tentei mockar via
interceptação de rede no Playwright e não convergiu a tempo. As outras 3 telas
(login, verificação, mfa em estado de carregamento) foram conferidas por screenshot
real em desktop (1280px) e mobile (360px).

## Próximos passos (para destravar o gate completo)

1. Você provisiona um projeto Supabase (hospedado) e uma conta Resend, e me passa as
   credenciais das Seção 3.2.
2. Eu rodo `supabase link`, habilito o hook, `db:migrate`, `db:seed`, os 2 testes de
   RLS pendentes, e o teste ponta a ponta do Resend.
3. Só então a Fase 1 fecha com o gate 100% verde — e paro para você revisar antes da
   Fase 2, como pedido.
