# Instrução de início — Fase 4 (Campo e automações)

> Este documento existe porque a sessão que fechou as Fases 1–3 ficou sem contexto
> para continuar. Foi escrito para uma sessão **nova**, sem memória da conversa
> anterior — leia isto por inteiro antes de escrever a primeira linha de código.

## O que fazer

Execute a **Fase 4 — Campo e automações** do `PROMPT-Comite-Digital.md` (leia a
seção inteira lá, comece por volta da linha 539 — "PWA instalável", "OCR", "pg_cron").
Siga o mesmo processo que já fechou as três fases anteriores: consultar as skills
obrigatórias **antes** de codar (Seção 2.1), TDD para toda lógica pura, e **parar no
gate de saída da Fase 4 e mostrar o resultado** — não avance para nada além disso
sem aprovação do usuário.

## Leitura obrigatória antes de começar, nesta ordem

1. **`PROMPT-Comite-Digital.md`** — fonte da verdade. Nunca editar/reformatar este
   arquivo (já está no `.prettierignore` por isso mesmo). Seção 9 tem a Fase 4
   completa; a Seção 2.1 tem a regra das consultas obrigatórias; a Seção 3.1 tem as
   regras de `service_role`/RLS que todo o projeto segue.
2. **`CONSULTAS.md`** — histórico completo de toda consulta a skill feita até aqui,
   com o que cada uma mudou. Continue registrando no mesmo formato de tabela.
3. **`PROGRESSO-FASE-2-3-4.md`** — o diário de bordo das Fases 1 a 3: o que foi
   entregue, os gates fechados (Fase 1: 8/9, pendente só por falta de domínio no
   Resend; Fase 2: 11/11; Fase 3: 6/6), e uma seção "Achados reais desta fase,
   corrigidos na hora" em cada uma — vale ler todas antes de mexer em código
   existente, porque documentam bugs reais já encontrados e corrigidos. Continue
   escrevendo neste mesmo arquivo, numa seção nova "Fase 4 — ...".
4. **`ACESSO.md`** e **`TESTE-LOCAL.md`** — como entrar no projeto e testar em
   localhost.

## Estado atual do projeto (resumo, não repita o trabalho)

- **Fases 1, 2 e 3 fechadas e testadas contra o Supabase real** (não é mockup —
  RLS, Realtime, Storage, PDF, XLSX, tudo rodando de verdade). Único pendente
  formal: entrega real de e-mail (decisão do usuário — sem domínio verificado no
  Resend por enquanto; a mecânica de idempotência/falha já está testada com
  transporte controlado, sem depender disso).
- Banco tem dado real semeado: **582 pessoas, 2.082 contratos** (seed fiel da Seção
  11 + carga de 500/2.000 para teste de desempenho).
- ~30 arquivos de teste (`tests/unit`, `tests/integration`) passando, todos contra
  o Supabase de verdade nos testes de integração (nunca mock de banco).
- Ainda existem **telas mockup paralelas** de uma fase de design que rodou em
  paralelo às Fases 1–3 (`git status` vai mostrar arquivos `??` não commitados —
  não são seus, não os commit, mas pode reaproveitar o design/CSS deles quando
  fizer sentido, documentando isso em `CONSULTAS.md` como já foi feito nas fases
  anteriores). Em especial: `src/app/(painel)/atividades/page.tsx` já existe como
  mockup — é o candidato natural para virar o "registro de atividade em 3 toques"
  real (item 1 da Fase 4).

## Regras de processo que continuam valendo

- **Seção 2.1 é obrigatória por fase**: Superpowers no início, Context 7 antes de
  qualquer código contra biblioteca externa nova, front-end-design antes de
  qualquer tela nova. Registre cada consulta em `CONSULTAS.md` — a coluna "o que
  mudou" é a que importa; se nada mudou, escreva isso explicitamente.
- **TDD (Lei de Ferro)**: para toda função pura/lógica de negócio, escreva o teste
  primeiro, confirme que falha (RED) por um motivo real (módulo/função não existe),
  só então implemente (GREEN). Isso já aconteceu para toda a lógica de negócio das
  Fases 1–3 — mantenha o padrão.
- **Verificação real, não só teste automatizado**: em várias entregas das Fases
  2–3, um teste unitário/integração passava mas só a verificação manual contra o
  banco/servidor real (`curl`, script direto com `postgres-js`/`@supabase/supabase-js`,
  ou uma chamada real à RPC) pegou um bug de verdade — leia
  "Achados reais" em `PROGRESSO-FASE-2-3-4.md` para ver exemplos concretos. Não dê
  nada por pronto só porque o teste passou — rode contra o projeto real também.
- **Git**: só faça `git add`/`git commit` dos arquivos que você mesmo escreveu.
  Nunca `git add -A` nem `git add .` — sempre liste os arquivos. Commits pequenos e
  atômicos, mensagem explicando o quê e o porquê, terminando com
  `Co-Authored-By: Claude <seu-nome-de-modelo> <noreply@anthropic.com>`.
- **Nunca editar `PROMPT-Comite-Digital.md`** nem rodar `prettier --write .` sem
  checar o `.prettierignore` primeiro (ele já protege esse arquivo e `.agents/`).

## Fatos operacionais para não redescobrir do zero

- **Credenciais**: estão em `.env.local` (gitignored, nunca commitar). Para rodar
  um script standalone contra o banco, use
  `npx tsx --env-file=.env.local caminho/do/script.mjs`; para comandos `npm run`,
  `export $(grep -v '^#' .env.local | xargs)` ou `set -a; source .env.local; set +a`
  antes.
- **`drizzle-kit migrate` trava indefinidamente** contra o pooler do Supabase
  hospedado (sem erro, sem lock — travado mesmo). Toda migration desta sessão foi
  aplicada com um script descartável usando `postgres-js` direto, dividindo o SQL
  por `--> statement-breakpoint` e aplicando dentro de `sql.begin(...)`. Escreva o
  `.sql` em `supabase/migrations/NNNN_nome.sql` (próximo número livre: **0011**)
  como se fosse aplicado por `drizzle-kit`, mas aplique de verdade com esse
  contorno. Veja qualquer migration 0005–0010 como exemplo do formato.
- **Nunca rode mais de um `next dev` ao mesmo tempo** — dois processos escrevendo
  no mesmo `.next` já corrompeu chunks e quebrou build várias vezes nesta sessão.
  Antes de `npm run build`, mate todo processo `next dev`/`next-server` residual
  (`ps aux | grep next`, `kill -9`), rode `rm -rf .next`, só então builde. Depois
  de qualquer mudança estrutural grande (arquivo novo numa rota existente), reinicie
  o `next dev` — cache obsoleto já causou um 500 enganoso mais de uma vez.
- **Sem `SUPABASE_ACCESS_TOKEN`** nesta sessão — `supabase link`/`supabase
  functions deploy` (CLI) não funcionaram até agora. **Isto é um bloqueio
  provável para o item 4 da Fase 4** (Edge Functions para os jobs de `pg_cron`):
  pesquise no Context 7 se dá para criar/agendar as Edge Functions só pelo
  Dashboard do Supabase (interface web) sem precisar da CLI, ou pergunte ao
  usuário se ele pode gerar um token de acesso pessoal e colocá-lo em
  `.env.local`. Não invente um caminho alternativo sem registrar a decisão.
- **`CRON_SECRET`** já existe como variável vazia em `.env.local`/`.env.example` —
  precisa ser gerada (`openssl rand -hex 32` ou similar) e usada para proteger as
  rotas de cron (item 5 do gate: "rota de cron sem CRON_SECRET responde 401").
- **Padrão de rota pública sem sessão** (usado em `/coleta/[token]` e no upload de
  documento, Fase 2): nunca use `src/lib/supabase/admin.ts`/`service_role` numa
  rota que atende um usuário anônimo. Em vez disso, escreva uma função Postgres
  `SECURITY DEFINER` que valida só o que precisa (um token, por exemplo) — veja
  `supabase/migrations/0005_links_coleta_publico.sql` e
  `0006_upload_coleta_publico.sql` como referência direta. Isso provavelmente se
  aplica à importação de planilha em lote (item 7) se ela puder ser feita por
  alguém sem sessão — confirme na Seção 5/9 do PROMPT se esse fluxo é autenticado
  ou não antes de decidir.
- **Rotas `/api/*` nunca redirecionam para `/login`** — o middleware já foi
  corrigido para isso (achado real da Fase 2). Cada rota de API faz sua própria
  checagem de autorização e devolve JSON com o status certo (401, etc.), nunca um
  307. As rotas de cron da Fase 4 devem seguir esse mesmo padrão, checando
  `CRON_SECRET` no cabeçalho/query e devolvendo 401 se faltar ou estiver errado.
- **Server Actions não serializam `Buffer`/`Uint8Array` cru** — quando precisar
  devolver binário (foi o caso de exportação de PDF/XLSX na Fase 3), converta para
  base64 no servidor e decodifique no cliente. Já tem um exemplo pronto em
  `src/app/(painel)/dashboard/acoes.ts` (`exportarRelatorioPdf`) e no client
  component correspondente (`baixarBase64`).
- **Limite de corpo de Server Action é 1 MB por padrão** — upload de arquivo
  (relevante para OCR de RG/CNH, item 3) deve ser um Route Handler
  (`src/app/api/.../route.ts`), não uma Server Action. Veja
  `src/app/api/coleta/[token]/documento/route.ts` como referência de upload real
  já validado (tipo, tamanho, dimensão).
- **RLS de `registros_atividade`** já existe desde a Fase 1
  (`organizationAndRegionPolicy` + `mfaGatePolicy`) e a tabela já está na
  publicação `supabase_realtime`. O campo `sincronizado_em` (nullable) já é o
  gancho natural para "fila local... com indicador honesto do que ainda não
  subiu" (item 2): `null` = ainda não sincronizado.
- **Nenhuma biblioteca de PWA, OCR ou XLSX-import está instalada ainda.** Antes de
  instalar qualquer uma, consulte o Context 7 (a Seção 2.1 exige isso) e registre
  em `CONSULTAS.md` — nesta sessão, decisões assim já divergiram do que parecia
  óbvio à primeira vista mais de uma vez (ex.: `xlsx`/SheetJS tinha vulnerabilidade
  sem correção via npm, trocado por `exceljs`; `pdf-lib` escolhido no lugar de
  Puppeteer/Chromium pensando na Netlify — ambos registrados em `CONSULTAS.md`,
  vale ler antes de decidir algo parecido para OCR/planilha).
- **Netlify é a hospedagem escolhida** (decisão registrada em `PROGRESSO.md`, fora
  do PROMPT original) — ao decidir arquitetura para `pg_cron`/Edge Functions/PWA,
  pense em compatibilidade serverless (evite dependências que exigem binário
  grande ou processo de longa duração).

## Convenções de código já estabelecidas — siga o mesmo padrão

Para qualquer tela nova em `src/app/(painel)/<rota>/`:

- `dados.ts` — funções `async` de leitura, sempre via
  `src/lib/supabase/server.ts` (RLS do usuário), nunca `admin.ts`.
- `acoes.ts` — Server Actions (`"use server"`), usando
  `obterContextoUsuario(supabase)` (`src/lib/supabase/contexto-usuario.ts`) para
  ler `organizacao_id`/`sub` do JWT, e `transporteEmailPadrao()`
  (`src/lib/notificacoes/transporte-padrao.ts`) quando precisar mandar e-mail.
- `page.tsx` — Server Component, só busca dado e passa pro client component.
- `<rota>-cliente.tsx` — Client Component, cuida de estado de UI/interação.
- Lógica de negócio pura (cálculo, validação, regra) vai em `src/lib/<área>/`,
  sempre com teste em `tests/unit/<área>/`, nunca misturada com o código de UI ou
  de acesso a banco.
- Migrations manuais em `supabase/migrations/NNNN_nome.sql`, com comentário no
  topo explicando o porquê, aplicadas pelo contorno do `postgres-js` (acima).
- Teste de integração vai contra o Supabase real (nunca mock), criando e
  limpando seus próprios dados em `beforeAll`/`afterAll` — veja qualquer arquivo
  em `tests/integration/` como modelo.

## O que a Fase 4 entrega (Seção 9 do PROMPT, resumido — leia o original)

1. Registro de atividade em **3 toques**, a partir da tela inicial.
2. PWA instalável, fila local em IndexedDB, sincronização automática ao voltar o
   sinal, indicador honesto do que ainda não subiu.
3. OCR sugerindo nome/CPF a partir de RG/CNH, **sempre com confirmação humana**
   antes de gravar.
4. `pg_cron` + Edge Functions para 4 jobs: `vigencia_a_vencer` (7 e 3 dias),
   `lembrete_assinatura` (3 dias em `enviado`), `resumo_diario` (dias úteis, 8h
   America/Sao_Paulo), reprocessamento de notificações `falhou`.
5. Rotas de cron protegidas por `CRON_SECRET`.
6. Retenção com expurgo de documentos pessoais ao fim da campanha, registrando o
   expurgo.
7. Importação de planilha de cadastro em lote, sinalizando duplicatas e
   documentos ilegíveis antes de gravar.

### Gate de saída da Fase 4 (rode e mostre o resultado — não avance sem isso)

- [ ] `CONSULTAS.md` registra Context 7 para `pg_cron`, Edge Functions e
      `tesseract.js`, e front-end-design para o fluxo de campo em 360 px.
- [ ] Registro de atividade em modo avião entra na fila e sobe sozinho ao
      restaurar a rede.
- [ ] Fluxo completo utilizável com uma só mão em viewport de 360 px.
- [ ] OCR nunca grava sem confirmação — teste prova isso.
- [ ] Rodar o job de vigência duas vezes no mesmo dia envia um único e-mail por
      contrato.
- [ ] Rota de cron sem `CRON_SECRET` responde 401.
- [ ] Fuso horário correto: o resumo das 8h de Brasília não sai às 5h nem às 11h.
- [ ] Importação de planilha com 2 CPFs repetidos sinaliza os 2 antes de gravar.

## Ordem sugerida (não é obrigatória, mas evita retrabalho)

1. Consultas obrigatórias primeiro (Superpowers, Context 7 para os 3 tópicos,
   front-end-design para o fluxo de campo) — registrar em `CONSULTAS.md` antes de
   qualquer código.
2. Item 5 (`CRON_SECRET`) e a estrutura de rota de cron protegida — é a base dos
   itens 4 e 6, pequeno e desbloqueia o resto.
3. Item 4 (`pg_cron` + jobs) — provavelmente esbarra no bloqueio de
   `SUPABASE_ACCESS_TOKEN` (acima); resolva isso com o usuário cedo, não no fim.
4. Item 1 (registro de atividade em 3 toques) — reaproveita
   `registros_atividade`, já pronto desde a Fase 1.
5. Item 2 (PWA/fila offline) — depende do item 1 já existir de verdade.
6. Item 3 (OCR) — mais isolado, pode vir em paralelo.
7. Item 7 (importação em lote) — mais isolado também.
8. Item 6 (retenção/expurgo) — deixe por último, é o que menos depende dos outros.

## Ao terminar

Atualize `PROGRESSO-FASE-2-3-4.md` com uma seção "Fase 4" no mesmo formato das
anteriores (o que foi entregue, achados reais corrigidos na hora, tabela do gate
com prova concreta por item) e **pare — aguarde revisão do usuário** antes de
considerar o projeto pronto para produção.
