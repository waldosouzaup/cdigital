# Verificação — Fases 2, 3 e 4 (estado em 2026-09-07)

> Rodado a pedido explícito do usuário: "Inicie a verificação da fase 2, 3 e 4. O
> projeto por enquanto não vai ter 'Domínio verificado no Resend'." Isto é uma
> **verificação de estado**, não uma implementação — nenhum código de produto foi
> escrito nesta rodada, só inspeção do que já existe e checagem automatizada
> (`lint`, `tsc`, `test:unit`).

## Resultado em uma frase

**As Fases 2, 3 e 4 ainda não começaram, no sentido do gate.** O que existe hoje sob
`(painel)/*` e `/coleta/[token]` é a casca visual (Tarefa de design paralela, não
minha), com `useState` e dado fixo — nenhuma delas fala com Supabase. Nenhum item de
gate das três fases está fechado. Abaixo, item a item, com o porquê.

---

## O que a checagem automatizada confirma agora (baseline limpo)

```
npm run lint        → limpo, 0 erros
npx tsc --noEmit     → limpo
npm run test:unit    → 59/59 passando (7 arquivos)
```

Nenhum teste novo de unidade ou integração existe ainda para Fase 2/3/4 — os 59 são
todos herdados da Fase 1 (CPF, valor por extenso, máquina de estados, caminho de
transições, chave de idempotência, webhook do Resend).

`npm run build` **não foi rodado nesta verificação** — havia um `next dev` ativo
(PID 95718) no momento da checagem, e rodar `build` em paralelo com `dev` foi a causa
raiz da corrupção de `.next` já vista duas vezes nesta sessão (ver `PROGRESSO.md`).
Rode `npm run build` manualmente depois de parar o `dev`, se quiser esse dado também.

---

## Fase 2 — Pessoas, documentos e contratos

### Entregas (14 itens do PROMPT) — nenhuma construída

| # | Entrega | Estado |
|---|---|---|
| 1 | CRUD de pessoas com CPF por dígito verificador | ❌ `(painel)/pessoas/page.tsx` é mockup: `useState` com array fixo, sem Server Action, sem `createClient` |
| 2 | Link público de coleta (`/coleta/[token]`) | ❌ existe a tela (`src/app/coleta/[token]/page.tsx`), também mockup — sem geração/validação real de token, sem expiração |
| 3 | Upload com validação síncrona (dimensão, hash, tipo, tamanho, 5s) | ❌ nenhum código de upload existe. `sharp` está instalado (`package.json`) mas não importado em lugar nenhum |
| 4 | Nomenclatura gerada pelo sistema | ❌ depende do item 3 |
| 5 | Versionamento de documento | ❌ depende do item 3 |
| 6 | Pessoa apta dispara `pessoa_apta` | ❌ não existe lógica de aptidão |
| 7 | Editor de templates com marcadores | ❌ não existe |
| 8 | Emissão de contrato em PDF com `valor_extenso` | ⚠️ `valor-extenso.ts` já existe e é testado (Fase 1) — falta tudo o resto: template, geração de PDF, ligação com `extenso` num fluxo real |
| 9 | Emissão em lote | ❌ não existe |
| 10 | Máquina de estados ligada a `eventos_contrato` em transação | ⚠️ `maquina-estados.ts` e `caminho-transicoes.ts` prontos e testados (Fase 1) — falta a Server Action que grava em transação e dispara notificação pós-commit |
| 11 | Registro de envio disparando `contrato_enviado` | ❌ não existe |
| 12 | Registro de assinatura (upload ou presencial) | ❌ não existe |
| 13 | Distrato gerando termo sem apagar original | ❌ não existe (a máquina de estados sabe o caminho `distratado`→`distrato_assinado`, mas nada gera o termo) |
| 14 | Checklist de pendências por pessoa | ❌ não existe |

### Gate de saída — 0 de 11 fechados

- [ ] Cadastro → link → documento → contrato emitido/enviado/assinado sem sair da aplicação — **não dá para testar, não há CRUD real**
- [ ] Upload 72×72px recusado — **não há upload**
- [ ] Upload duplicado (hash) recusado — **não há upload**
- [ ] R$ 3.553,00 / 2.200,00 / 4.353,00 / 1.500,00 por extenso — **✅ já coberto pelos testes de Fase 1** (`valor-extenso.test.ts`), reaproveitável sem mudança
- [ ] Transição inválida rejeitada — **✅ já coberto** (`maquina-estados.test.ts`), reaproveitável
- [ ] Toda transição gera `eventos_contrato` — **parcial**: a tabela e o schema existem (Fase 1); falta a Server Action que efetivamente grava
- [ ] `contrato_enviado` duplicado envia um único e-mail — **a infraestrutura de idempotência existe e é testada** (`chave-idempotencia.test.ts`, `enviar.test.ts`), mas nada no produto chama isso ainda para este evento
- [ ] Queda do Resend não derruba o contrato — infraestrutura de retry/falha existe (`enviar.ts`), não está ligada a um fluxo real
- [ ] `CONSULTAS.md` registrando Context 7 (Storage, Resend, React Email) + front-end-design (pessoas/upload/coleta) para esta fase — ❌ **ainda não registrado**, porque a fase não começou de fato

**Sobre o Resend sem domínio verificado:** não bloqueia nenhum destes itens de teste —
idempotência e simulação de falha são testáveis com transporte injetado/mockado (como já
foi feito na Fase 1), sem depender de domínio, SPF/DKIM/DMARC. O que fica bloqueado é só
a entrega real do e-mail num teste de ponta a ponta com caixa de entrada de verdade (item
já registrado como pendente desde a Fase 1).

---

## Fase 3 — Dashboard em tempo real

| # | Entrega | Estado |
|---|---|---|
| 1 | Matriz categoria × status com totais | ❌ `dashboard/page.tsx` mostra números fixos em `useState`, não vem de `SELECT` nenhum |
| 2 | Realtime (Postgres Changes) com RLS validado no canal | ❌ nenhuma assinatura Realtime no código; a publicação `supabase_realtime` foi criada na migration da Fase 1 (`0003_triggers_realtime.sql`), mas nada no cliente escuta ela |
| 3 | Detalhamento progressivo (2 cliques) | ❌ não existe navegação real entre número e lista nominal |
| 4 | Visão por região | ❌ não existe |
| 5 | Funil cadastrado→apto→emitido→enviado→assinado | ❌ não existe |
| 6 | Central de pendências com notificações falhas | ❌ não existe |
| 7 | Exportação PDF/XLSX | ❌ não existe; nenhuma lib de PDF/XLSX no `package.json` |

### Gate de saída — 0 de 6 fechados

Todos dependem de dado real existir primeiro (Fase 2) e de uma consulta real acontecer —
não há como medir "dashboard carrega em <2s com 500 pessoas/2.000 contratos" sobre uma
página que não lê o banco. `CONSULTAS.md` também não tem entrada de Realtime para esta
fase ainda.

---

## Fase 4 — Campo e automações

| # | Entrega | Estado |
|---|---|---|
| 1 | Registro de atividade em 3 toques | ❌ `atividades/page.tsx` é mockup |
| 2 | PWA com fila IndexedDB e sync | ❌ nenhum `manifest.json`, nenhum service worker, nenhuma lib PWA instalada |
| 3 | OCR (RG/CNH) com confirmação humana | ❌ nenhuma lib de OCR (`tesseract.js` ou similar) instalada |
| 4 | `pg_cron` + Edge Functions (4 jobs) | ❌ nenhuma Edge Function, nenhum job `pg_cron` agendado no banco |
| 5 | Rotas de cron protegidas por `CRON_SECRET` | ❌ não existem rotas `/api/cron/*`; `CRON_SECRET` está no `.env.local` vazio, reservado desde a Fase 1 |
| 6 | Retenção/expurgo de documentos | ❌ não existe |
| 7 | Importação de planilha em lote | ❌ não existe |

### Gate de saída — 0 de 7 fechados

Nada aqui foi tocado ainda. `CONSULTAS.md` sem entrada de `pg_cron`/Edge
Functions/`tesseract.js` para esta fase.

---

## O que isso muda na prática

1. **A UI mockup que apareceu em paralelo (`(painel)/*`, `/coleta/[token]`, os novos
   componentes em `src/components/`) é ponto de partida visual, não implementação.**
   Ela ajuda a Fase 2/3/4 a começarem mais rápido (o design já existe), mas cada tela
   precisa ganhar Server Actions, validação e leitura/escrita real no Supabase — hoje
   é indistinguível de um protótipo estático.
2. **O que a Fase 1 deixou pronto e é diretamente reaproveitável sem retrabalho:**
   `maquina-estados.ts`, `caminho-transicoes.ts`, `valor-extenso.ts`, `cpf.ts`,
   `chave-idempotencia.ts`, `enviar.ts`/`transporte.ts`/`webhook.ts` (notificações),
   `registrar.ts` (auditoria), `url-assinada.ts` (Storage). Fase 2 é, em boa parte,
   "ligar peças que já existem e são testadas" a Server Actions novas — não é partir do
   zero na lógica de negócio, só na integração.
3. **A ausência de domínio verificado no Resend não impede começar a Fase 2** — só
   adia o teste de entrega real de e-mail (que já estava pendente desde a Fase 1) e
   mantém em aberto o item de NFR "e-mail com SPF/DKIM/DMARC" (Seção 10) até haver
   domínio.
4. Nenhuma das três fases tem entrada em `CONSULTAS.md` ainda — pela Seção 2.1, isso é
   pré-requisito **antes** de codar cada fase, não depois.

## Próximo passo, se quiser seguir

Fase 2 é a única das três que não depende de outra estar pronta. Ela deveria começar
pela mesma disciplina da Fase 1: registrar as consultas obrigatórias em `CONSULTAS.md`
(Context 7 para Storage/Resend/React Email, front-end-design revisando as telas já
desenhadas), escrever o teste que falha antes do código (TDD), e só então ligar CRUD de
pessoas → upload → contrato à infraestrutura que já existe.

Este documento é só o diagnóstico pedido. Nenhuma implementação foi iniciada.

---

## Atualização — 2026-09-07 (mesmo dia): Fase 2 iniciada

A pedido do usuário ("Inicie a fase 2"), o item 1 da Fase 2 começou a sair do papel.
Registro do que mudou desde o diagnóstico acima:

### Bug encontrado e corrigido antes de wirear qualquer dado real

`src/middleware.ts`: a função `ehRotaPublica` incluía as rotas do painel
(`/dashboard`, `/pessoas` etc.) na própria lista de rotas **públicas** — o middleware
nunca redirecionava usuário não autenticado para `/login` ao acessar essas rotas. O
RLS não deixava dado vazar (sem JWT autenticado, a policy nega tudo), mas a casca da
tela ficava acessível sem sessão, o que contraria a Seção 3. Corrigido e confirmado
com `curl`: `GET /pessoas` sem cookie de sessão agora responde `307` para `/login`.

### CRUD de pessoas — criação e listagem reais (item 1 da Fase 2)

- `src/lib/pessoas/validacao.ts` — validação de entrada (Zod + `isValidCpf` já
  existente), com teste TDD (`tests/unit/pessoas/validacao.test.ts`, RED confirmado
  antes de escrever a implementação).
- `src/app/(painel)/pessoas/dados.ts` — leitura real via `server.ts` (RLS do usuário),
  com join em `regioes` e `contratos` para status.
- `src/app/(painel)/pessoas/acoes.ts` — Server Action `criarPessoa`: valida, busca
  `organizacao_id`/`sub` do JWT (`getClaims()`), **checa CPF duplicado por SELECT e
  devolve o registro existente em vez de criar outro** (item 1 do gate), com o índice
  único do banco como rede de segurança contra corrida (código `23505` tratado, sem
  stack trace), grava `log_auditoria` via `registerPersonWrite` (Fase 1, item 10, já
  existente e agora finalmente chamado por um fluxo real), e chama `revalidatePath`.
- `src/app/(painel)/pessoas/page.tsx` + `pessoas-cliente.tsx` — a tela deixou de ser
  mockup: Server Component busca dado real, Client Component só cuida de busca/filtro/
  modal. O dropdown de região agora vem de `select nome from regioes` (11 regiões
  reais), não mais da lista incompleta e com nomes errados que o mockup tinha.
- **Teste de integração novo, contra o Supabase real**
  (`tests/integration/pessoas-cpf-duplicado.test.ts`): insere uma pessoa, tenta inserir
  o mesmo CPF na mesma organização, confirma erro `23505` tratado. Passou.

### Checagem automatizada depois da mudança

```
npx tsc --noEmit       → limpo
npm run lint           → limpo
npm run test:unit      → 64/64 (5 novos, CPF/validação de pessoa)
npm run test:integration → 8/8 (RLS, webhook, CPF duplicado)
curl GET /pessoas sem sessão → 307 → /login (antes: 200, bug)
```

### O que do item 1 ainda falta (não fechado)

- CPF duplicado hoje só é bloqueado — falta um caminho na UI para "ver o cadastro
  existente" além da mensagem (`pessoaExistenteId` já vem no estado, falta usar).
  Nenhum campo de edição/exclusão de pessoa existe ainda (CRUD ainda é só C+R).
- Link público de coleta (item 2) continua placeholder — geração de token real,
  expiração e RLS de acesso sem login não foram tocados.
- Upload de documento, template de contrato, emissão, distrato — nada disso começou
  (itens 3 a 14 da Fase 2 seguem como no diagnóstico original acima).

Fase 2 gate: ainda 0/11 fechado formalmente (nenhum item do gate em si virou ✅ ainda,
porque o gate pede o fluxo ponta a ponta completo), mas o item 1 já tem código real,
testado, rodando contra o Supabase de verdade — não é mais só a casca visual.
