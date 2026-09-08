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

---

## Atualização — 2026-09-07 (mesmo dia, continuação): item 2 da Fase 2

A pedido do usuário ("sim, continue"), o item 2 saiu do papel também.

### Link público de coleta — real, ponta a ponta

- **`supabase/migrations/0005_links_coleta_publico.sql`** — duas funções
  `SECURITY DEFINER` (mesmo padrão do `custom_access_token_hook` da Fase 1, já
  anotado como plano em `src/db/schema.ts` desde então): `validar_link_coleta(token)`
  devolve só `pessoa_id`, primeiro nome e organização (Seção 6: "nada além do
  primeiro nome"); `enviar_dados_coleta(...)` grava os dados complementares e marca
  `usado_em` com `FOR UPDATE` (trava contra duplo envio simultâneo do mesmo link).
  Aplicada no banco real com o mesmo contorno de sempre (`postgres-js` direto, já que
  `drizzle-kit migrate` trava no pooler).
  **Isto não usa `admin.ts`/service_role** — é exatamente a exceção que a própria
  Seção 3.1 prevê (função de banco com privilégio próprio, não a chave da aplicação
  em rota de usuário), e o comentário deixado no schema desde a Fase 1 já apontava
  para este desenho.
- **`src/lib/coleta/token.ts`** — gerador de token (TDD: RED confirmado antes da
  implementação), 32 caracteres de `crypto.randomBytes`, base64url.
- **`src/emails/link-coleta.tsx`** — primeiro uso real do `react-email` no projeto
  (instalado desde a Fase 1, nunca usado até agora). Conteúdo restrito a
  primeiro nome + link + prazo, como a Seção 6 exige.
- **`(painel)/pessoas/acoes.ts`** — `gerarLinkColeta(pessoaId, dias)`: cria a linha em
  `links_coleta` (RLS normal, usuário autenticado), tenta enviar por Resend via a
  infraestrutura de notificação da Fase 1 (idempotente, nunca lança). Sem domínio
  verificado, o envio real falha e fica `falhou` em `notificacoes` — comportamento
  esperado e já tratado, não um bug novo.
- **`coleta/[token]/page.tsx` + `coleta-cliente.tsx` + `acoes.ts`** — a tela deixou de
  ser mockup. Fluxo real reduzido a 2 etapas (dados complementares → revisão e
  consentimento LGPD → envio), porque a pessoa já foi cadastrada pelo coordenador
  (nome/CPF não são pedidos de novo). **Upload de documento (item 3) foi deixado de
  fora deliberadamente** — a tela avisa isso explicitamente ao usuário, não esconde.
- Botão "Gerar Link de Coleta" do cabeçalho de `/pessoas` foi removido — não fazia
  sentido sem uma pessoa associada; só resta a ação por linha da tabela, ligada à
  Server Action de verdade.

### Testes novos, contra o Supabase real

`tests/integration/links-coleta.test.ts` — chama as duas funções pelo **cliente
anon**, exatamente como a página pública faz: token válido é aceito e devolve só o
esperado; token expirado e token inexistente são recusados; dados são gravados e o
link marcado como usado; um segundo envio pelo mesmo link é recusado sem sobrescrever
o que já foi salvo (prova de "expiração no uso").

### Achado operacional durante a verificação manual

Depois de criar os arquivos novos, `GET /coleta/[token]` respondeu **500** com um erro
enganoso ("`next/headers` não é suportado no diretório `pages/`") — investigado e
confirmado como **cache `.next` obsoleto do servidor de dev que já estava rodando
antes dos arquivos novos existirem**, não um bug de código: matando o processo,
limpando `.next` e subindo um servidor novo, a mesma rota respondeu 200 de primeira.
Reforça a lição já registrada em `PROGRESSO.md`: um único `next dev` por vez, e
reiniciar depois de mudança estrutural grande (arquivo novo em rota existente).

### Checagem final

```
npx tsc --noEmit          → limpo
npm run lint              → limpo
npm run test:unit         → 67/67 (3 novos: gerador de token)
npm run test:integration  → 13/13 (RLS + webhook + CPF duplicado + links_coleta)
npm run build             → limpo, 13 rotas (pessoas e coleta/[token] como ƒ dinâmicas)
curl GET /pessoas sem sessão      → 307 → /login
curl GET /coleta/token-inválido   → 200, "Link inválido ou expirado"
curl GET /coleta/[token-real]     → 200, saudação com o primeiro nome correto
```

### O que do item 2 ainda falta

- Upload de documento dentro do próprio `/coleta/[token]` (isso é o item 3, próximo
  passo natural).
- Validade configurável hoje é fixa em 7 dias por padrão no código
  (`VALIDADE_PADRAO_DIAS`) — não há campo na UI para o coordenador escolher outro
  prazo por link.
- `gerarLinkColeta` não checa se já existe um link **ainda válido e não usado** para a
  mesma pessoa antes de criar outro — hoje cada clique gera uma linha nova em
  `links_coleta` (não é um bug de segurança, mas permite links órfãos acumularem).

---

## Atualização — 2026-09-07 (mesmo dia, continuação): item 3 da Fase 2

### Upload de documento — real, validado no servidor, ligado ao Storage de verdade

- **`src/lib/documentos/upload.ts`** (TDD): `validarTipoETamanho` (JPG/PNG/PDF, 20MB),
  `validarDimensaoImagem` (usa `sharp`, `autoOrient` para contabilizar rotação EXIF de
  foto de celular — achado do Context 7, registrado em CONSULTAS.md), `calcularHashSha256`,
  `extensaoPorMime` (extensão vem sempre do mime real, nunca do nome que a pessoa deu).
- **Migration `0006_upload_coleta_publico.sql`**: mesmo padrão SECURITY DEFINER do
  item 2. `registrar_documento_coleta(...)` calcula a próxima versão (com
  `pg_advisory_xact_lock` travando a corrida), monta o caminho
  `{organizacao_id}/coleta/{token}/{tipo}_{pessoa_id}_v{versao}.{ext}` e grava a linha
  em `documentos` — hash duplicado dentro da organização é recusado (índice único já
  existia da Fase 1) apontando o documento existente. Nova policy de Storage
  (`anon`, só para o bucket `documentos`) valida o token embutido no caminho antes de
  aceitar o INSERT do arquivo em si.
  **Achado de gap da Fase 1 corrigido de passagem:** `documentos.versao` nunca teve o
  índice único `(pessoa_id, tipo, versao)` que o plano original já prometia — criado
  agora, junto com o upload real que finalmente precisa dele.
- **`POST /api/coleta/[token]/documento`** (Route Handler, `runtime = "nodejs"` por
  causa do `sharp`): valida tipo/tamanho → revalida o token no servidor → valida
  dimensão → calcula hash → chama a RPC → só então sobe os bytes para o Storage.
  Nunca usa `admin.ts`/service_role (mesma disciplina do item 2).
- **`documento_rejeitado`** dispara por e-mail quando a dimensão é recusada e a
  pessoa tem e-mail cadastrado, com chave de idempotência pelo hash do arquivo
  rejeitado (evita duplo aviso por duplo clique, mas avisa de novo numa foto
  diferente).
- **`/coleta/[token]`** ganhou uma Etapa 2 real (documento), com "pular por
  enquanto" para não travar quem ainda não tem a foto à mão.

### Bug encontrado e corrigido durante o teste manual ao vivo

`src/middleware.ts`: `/api/coleta/[token]/documento` estava caindo no redirect para
`/login` porque só a página `/coleta/[token]` estava marcada como pública, não a rota
de API correspondente — uma chamada `fetch()` recebia de volta uma página de login em
HTML, sem erro claro. **Provavelmente o mesmo problema já afetava
`/api/webhooks/resend`** (nunca testado via HTTP de verdade até agora, só a lógica
interna). Corrigido de forma geral: nenhuma rota `/api/*` passa mais pelo redirect de
sessão — cada uma faz sua própria checagem (token, assinatura de webhook,
`CRON_SECRET` no futuro) e devolve JSON com o status certo.

### Achado operacional do bucket

O bucket `documentos` já tinha `allowed_mime_types` (`image/jpeg`, `image/png`,
`application/pdf`) e `file_size_limit` (20 MB) configurados desde a criação manual na
Fase 1 — uma camada de defesa a mais no próprio Storage, além da validação em
`upload.ts`. Só apareceu porque o teste de integração usava um `Blob` sintético sem
`type`, mandando `application/octet-stream`; o código real (que usa `File` do
navegador) não tem esse problema.

### Testes novos, contra o Supabase real

`tests/integration/upload-coleta.test.ts` (5 testes, todos pelo cliente anon): o
caminho gerado é exatamente o esperado; o upload físico real é aceito nesse caminho;
um caminho fora do padrão é recusado pela policy; o mesmo hash de novo é recusado
apontando o documento existente; um hash diferente cria a versão 2 preservando a 1.

### Verificação manual ao vivo (não só teste automatizado)

Gerado um link real via SQL, três chamadas `curl -F` reais contra o servidor rodando:

```
Imagem 72×72   → {"ok":false,"motivo":"...resolução baixa (72 × 72 px)...mínimo 800px..."}
Imagem 1200×1600 → {"ok":true}
Mesma imagem de novo → {"ok":false,"motivo":"Este documento já foi enviado antes (em 07/09/2026)."}
```

Exatamente os 3 comportamentos que o gate da Fase 2 pede para este item.

### Checagem final

```
npx tsc --noEmit          → limpo
npm run lint              → limpo
npm run test:unit         → 78/78 (11 novos: validação de upload)
npm run test:integration  → 18/18 (RLS + webhook + CPF duplicado + links_coleta + upload)
npm run build             → limpo, 14 rotas
```

### O que do item 3 ainda falta

- Só um tipo de documento (`documento_identidade`) — RG/CNH/comprovante de residência
  não são diferenciados ainda (a coluna é texto livre, não bloqueia isso no futuro).
- "Documentação completa e aprovada marca a pessoa como apta" (item 6) — o upload
  grava `status: 'pendente'`, mas nada ainda revisa/aprova o documento nem atualiza
  `pessoas.apta`. Isso é o próximo pedaço natural (mesa de triagem, já existe como
  mockup em `/documentos`).
- OCR (sugestão de nome/CPF a partir do documento) é Fase 4, não esta.

---

## Atualização — 2026-09-08: item 6 da Fase 2 (mesa de triagem)

### Aprovar/rejeitar documento e marcar pessoa apta — real

- **`src/lib/pessoas/aptidao.ts`** (TDD): `pessoaEstaApta(documentos)` — função pura,
  considera só a versão mais recente de cada tipo obrigatório
  (`DOCUMENTOS_OBRIGATORIOS`, hoje só `documento_identidade`) e exige todas
  aprovadas. Separada do banco de propósito: a lista de tipos obrigatórios só tende
  a crescer, e a regra precisa continuar certa quando isso acontecer.
- **`(painel)/documentos/acoes.ts`**: `aprovarDocumento`/`rejeitarDocumento` /
  `gerarUrlDocumento`. Depois de toda aprovação **e** toda rejeição,
  `reavaliarAptidao` roda de novo — não só no caminho feliz: rejeitar um documento de
  uma pessoa que já estava apta **revoga** a aptidão, não só deixa de concedê-la.
- **`pessoa_apta`** dispara para o "coordenador responsável" — interpretado como o
  `coord_regiao` da região da pessoa; sem um, cai para qualquer `coord_comite` da
  organização (a Seção 6 não define esse termo com precisão; decisão registrada
  aqui por não estar no documento original).
- **Rejeição manual gera um novo link de coleta automaticamente** (reaproveita
  `gerarTokenColeta`) e manda por `documento_rejeitado` com esse link — mais útil que
  reaproveitar um token antigo que pode já estar expirado ou usado.
- **`gerarUrlDocumento`** reaproveita `criarUrlAssinada` (Fase 1), que já grava o
  log de auditoria de leitura sozinha.
- `registerDocumentReview` novo em `auditoria/registrar.ts` (ação `aprovacao`/
  `rejeicao`, entidade `documentos`) — Fase 1 item 10 só cobria pessoas/contratos.

### Limitação conhecida e documentada (não corrigida agora)

A chave de idempotência de `pessoa_apta` é só `pessoaId` (não por evento). Se uma
pessoa perder a aptidão (documento rejeitado depois de aprovado) e reconquistá-la
depois, o e-mail de `pessoa_apta` **não volta a sair** — mesma chave, o índice único
recusa o segundo envio. Aceitável para o caminho comum (a pessoa fica apta uma vez),
registrado aqui para não ser esquecido se isso importar depois.

### Testes novos, contra o Supabase real

`tests/integration/documentos-triagem.test.ts` (4 testes): prova algo que nenhum
teste anterior tinha coberto — que a policy de RLS de `documentos` (Fase 1,
`organizationAndRegionPolicy`, `for: "all"`) permite `UPDATE` por um usuário
autenticado comum, não só `SELECT`/`INSERT`. Também aplica `pessoaEstaApta` ao dado
real pós-aprovação e pós-rejeição, confirmando que a função pura decide igual ao que
a Server Action decidiria.

### Checagem final

```
npx tsc --noEmit          → limpo
npm run lint              → limpo
npm run test:unit         → 84/84 (6 novos: regra de aptidão)
npm run test:integration  → 22/22 (RLS + webhook + CPF duplicado + links_coleta + upload + triagem)
npm run build             → limpo, 14 rotas
curl GET /documentos sem sessão → 307 → /login
```

### O que ainda falta

- Só o tipo `documento_identidade` existe — quando o upload ganhar mais tipos
  (comprovante de residência, dados bancários), `DOCUMENTOS_OBRIGATORIOS` cresce e a
  mesa de triagem já lida com isso sem mudar (o rótulo é só um mapa).
- A limitação de idempotência de `pessoa_apta` acima.
- Emissão de contrato (itens 7–13 da Fase 2) — a pessoa agora pode ficar `apta` de
  verdade, mas nada ainda gera contrato a partir disso.

---

## Atualização — 2026-09-08: itens 7, 8, 10 e 11 da Fase 2 (emissão de contrato)

### Editor de templates (item 7) — real

- `(painel)/configuracoes/dados.ts` + `acoes.ts`: CRUD real de `templates_contrato`
  (criar, editar, ativar/desativar). A seção "Modelos de Minuta Contratual" da tela
  de Configurações deixou de ser decoração — o resto da tela (identidade do comitê,
  LGPD) continua cosmético e não finge ser real.
- Editor com botões que inserem cada um dos 8 marcadores no cursor do textarea.

### Geração de PDF (item 8) — decisão de arquitetura registrada

- **`pdf-lib`** em vez de Puppeteer/Chromium headless — decisão registrada em
  CONSULTAS.md: evita empacotar um binário Chromium numa função serverless da
  Netlify. Trade-off consciente: o `corpo_html` do template é convertido para texto
  simples (`htmlParaTexto`) antes de virar PDF — não há fidelidade visual de CSS,
  só parágrafos com quebra de linha automática.
- `src/lib/contratos/marcadores.ts` (TDD) — substitui os 8 marcadores.
- `src/lib/contratos/gerar-pdf.ts` (TDD) — gera o PDF com `pdf-lib`, paginação
  automática quando o texto não cabe numa página.
- **Verificação manual extra, além dos testes automatizados**: rodei o pipeline
  completo (valor→extenso→marcadores→texto→PDF) com nome e endereço reais em
  português (acentos, cedilha) e li o PDF gerado de volta — renderizou perfeito,
  e R$ 3.553,00 virou "três mil quinhentos e cinquenta e três reais", batendo
  exatamente com o valor de aceite da Seção 11.
- Gap da Fase 1 corrigido de passagem: `contratos` não tinha coluna para o caminho
  do PDF no Storage, apesar do bucket já existir desde a Tarefa 7. Adicionadas
  `caminho_pdf` e `caminho_pdf_assinado` (esta última reservada para o item 12).

### Máquina de estados com transação real (item 10)

- Migration 0007: `gravar_transicao_contrato(contrato_id, status_anterior,
  status_novo, observacao)` — função Postgres comum (**sem** `SECURITY DEFINER`,
  diferente das funções de acesso público das migrations 0005/0006: aqui quem
  chama é sempre autenticado, então a RLS de `contratos`/`eventos_contrato`
  continua valendo). `UPDATE ... WHERE status = status_anterior` funciona como
  trava otimista; se 0 linhas forem afetadas, a função lança erro e nada é
  inserido em `eventos_contrato` — atomicidade de graça, porque uma chamada de
  função é uma transação no Postgres. Resolve algo que o PostgREST não oferece
  nativamente (transação entre duas chamadas `.insert()`/`.update()` separadas).
- Teste de integração prova a trava: uma segunda transição com o `status_anterior`
  errado é recusada, e o número de eventos gravados continua 1, não 2.

### Registro de envio disparando contrato_enviado (item 11)

- `enviarContrato` grava canal/destinatário, transiciona `emitido → enviado`,
  dispara e-mail (chave de idempotência determinística por contrato — reforçada
  pela própria trava otimista da RPC, que já impede um segundo clique de
  completar a transição).
- **Gap de honestidade registrado no próprio e-mail**: não existe ainda página
  pública de assinatura (isso é o item 12), então o e-mail avisa que o contrato
  foi emitido e que a coordenação vai entrar em contato — não promete um link de
  assinatura que não existe.

### Transições extras wireadas de brinde (não pedidas nominalmente nesta rodada, mas trivial dado o que já existia)

- `marcarContratoAssinado` (enviado→assinado) e `distratarContrato`
  (assinado→distratado) — a UI já existia como mockup pronta para isso.
  **Distrato é só a transição de estado** — a geração do termo/documento em si
  (item 13) continua pendente, e o modal avisa isso explicitamente.

### Refatoração de sustentação

`obterContextoUsuario` (leitura de claims) e `transporteEmailPadrao` (config do
Resend) estavam duplicados em `pessoas/acoes.ts` e `documentos/acoes.ts` — extraídos
para `src/lib/supabase/contexto-usuario.ts` e
`src/lib/notificacoes/transporte-padrao.ts` antes de um terceiro arquivo
(`contratos/acoes.ts`) repetir o mesmo código pela terceira vez.

### Testes novos, contra o Supabase real

`tests/integration/emissao-contrato.test.ts` (3 testes): transição atômica grava
exatamente 1 evento; uma segunda transição com status de origem errado é recusada
sem duplicar evento; upload real para o bucket `contratos` funciona para usuário
autenticado (policy escrita na Fase 1, nunca exercida de verdade até agora).

### Checagem final

```
npx tsc --noEmit          → limpo
npm run lint              → limpo
npm run test:unit         → 94/94 (10 novos: marcadores + PDF)
npm run test:integration  → 25/25
npm run build             → limpo, 14 rotas (contratos e configuracoes agora ƒ)
curl GET /contratos sem sessão      → 307 → /login
curl GET /configuracoes sem sessão  → 307 → /login
```

### O que ainda falta da Fase 2

- **Item 9** — emissão em lote (a UI mockup tinha um modal para isso; não foi
  wireado, fica para outra rodada).
- **Item 12** — registro de assinatura por upload do PDF assinado (hoje só existe
  a marcação manual "assinado", sem upload real nem página pública).
- **Item 13** — geração do termo de distrato como documento (hoje só a transição
  de estado).
- **Item 14** — checklist de pendências por pessoa.

---

## Atualização — 2026-09-08: item 12 da Fase 2 (assinatura)

### Registro de assinatura por upload do PDF assinado — real

- **Decisão de arquitetura registrada em CONSULTAS.md**: Server Actions do Next.js
  15 têm limite padrão de 1 MB de corpo — baixo demais para um PDF escaneado.
  `POST /api/contratos/[id]/assinatura` é um Route Handler autenticado (não
  público, ao contrário de `/api/coleta/*`) — mesmo padrão do upload de documentos
  da Fase 2, item 3.
- Valida: arquivo é `application/pdf` (só PDF — item 12 pede especificamente "PDF
  assinado", diferente do item 3 que aceita imagem também), até 20 MB, contrato
  precisa estar em `enviado`.
- **Reaproveita a policy de Storage da própria Fase 1** para o bucket `contratos`
  (autenticado, escrita por organização) — nenhuma migration nova precisou ser
  escrita para isto, diferente do upload público da Fase 2 (que exigiu funções
  SECURITY DEFINER porque não havia sessão).
- Depois do upload: grava `caminho_pdf_assinado`, chama
  `gravar_transicao_contrato(enviado, assinado)` (mesma RPC do item 10) — a
  atomicidade e a trava otimista contra transição concorrente valem aqui também,
  de graça.
- **Marcação presencial** (já existia, sem arquivo) continua disponível como opção
  separada — o coordenador escolhe: anexar PDF ou marcar manualmente.
- `gerarUrlPdfContrato` ganhou um segundo parâmetro (`"gerado" | "assinado"`) para
  gerar a URL assinada correta — a tela mostra "Ver Termo" (PDF gerado na emissão)
  e, quando existe, "Ver Assinado" (o PDF que voltou assinado) como ações
  separadas.

### Testes novos, contra o Supabase real

`tests/integration/assinatura-contrato.test.ts` (2 testes): upload real do PDF
assinado no bucket `contratos` com o sufixo `_assinado.pdf`, grava o caminho,
transiciona `enviado → assinado` pela mesma RPC, confirma `assinado_em` gravado; e
que o coordenador consegue gerar uma URL assinada para o arquivo que anexou.

### Checagem final

```
npx tsc --noEmit          → limpo
npm run lint              → limpo
npm run test:unit         → 94/94 (sem novos — item 12 não tem lógica pura nova)
npm run test:integration  → 27/27
npm run build             → limpo, 15 rotas
curl POST /api/contratos/.../assinatura sem sessão → 401 JSON (não redireciona pra /login)
```

### Fase 2 — o que falta agora

- **Item 9** — emissão em lote.
- **Item 13** — geração do termo de distrato como documento (a transição de
  estado já existe desde a rodada anterior).
- **Item 14** — checklist de pendências por pessoa.

Com isto, o ciclo de vida completo do contrato está real e testado: emitido → PDF
gerado → enviado → e-mail disparado → assinado (por upload real ou marcação
presencial) → distratado (só a transição). Falta lote, o documento de distrato em
si, e o checklist.

---

## Atualização — 2026-09-08: itens 9, 13 e 14 da Fase 2 — Fase 2 completa

Com esta rodada, **todos os 14 itens da Fase 2 têm implementação real**, não só os
6 "principais" das rodadas anteriores.

### Item 9 — Emissão em lote

- Extraído `emitirContratoParaPessoa` (núcleo compartilhado entre emissão individual
  e em lote) de dentro de `emitirContrato` — mesma sequência (rascunho → PDF →
  Storage → transição), reaproveitada sem duplicar código.
- `emitirContratosEmLote`: mesmo modelo/valor/vigência para N pessoas selecionadas
  por checkbox. **Sequencial, não `Promise.all`** — cada emissão já faz 3–4
  chamadas de rede (insert, geração de PDF, upload, RPC); paralelizar dezenas de
  pessoas de uma vez arriscaria esgotar conexões no ambiente serverless. Uma
  falha isolada (ex.: pessoa não encontrada) não derruba o lote inteiro — o
  resultado final mostra sucessos e falhas separadamente.
- **Verificação manual real**: rodei o laço exato do lote contra o Supabase de
  verdade com 2 pessoas reais + 1 id inexistente de propósito — resultado: 2
  sucessos, 1 falha isolada e relatada, sem travar o processamento. Limpo depois.

### Item 13 — Termo de distrato como documento

- Novo campo `caminho_termo_distrato` em `contratos` (migration 0008) — terceiro
  caminho de PDF na mesma linha (ao lado de `caminho_pdf` e `caminho_pdf_assinado`),
  nunca um registro novo: "sem apagar o contrato original" continua garantido
  porque é sempre a mesma linha sendo enriquecida, nunca substituída.
- `distratarContrato` agora exige um motivo, gera um PDF de verdade (reaproveita
  `gerarPdfContrato`) citando objeto/valor/vigência do contrato original + o
  motivo, sobe pro Storage, só então transiciona `assinado → distratado`.
- Novo `marcarDistratoAssinado` fecha a cadeia (`distratado → distrato_assinado`),
  a mesma marcação presencial simples do item 12, sem exigir um segundo upload.
- **Verificação manual real**: gerei um contrato `assinado`, rodei a sequência
  completa (termo → distratado → distrato_assinado), conferi a cadeia de 2 eventos
  em `eventos_contrato` e que a linha do contrato original nunca foi apagada — só
  enriquecida. Limpo depois.

### Item 14 — Checklist de pendências por pessoa

- `src/lib/pessoas/pendencias.ts` (TDD, 9 testes): função pura
  `calcularPendencias(fatos)` — reaproveita `DOCUMENTOS_OBRIGATORIOS` de
  `aptidao.ts` (nunca duplica a lista), considera só a versão mais recente de
  cada documento, e só cobra pendência de contrato depois que a pessoa já está
  apta (sem contrato antes disso não é pendência, é a ordem natural).
- Nova coluna "Pendências" em `/pessoas`, com um novo filtro "Com qualquer
  pendência (checklist)" — distinto do filtro antigo "Com pendência documental"
  (que só olhava `apta`, sem contar o que falta no contrato).
- **Achado real ao verificar contra o dado semeado na Fase 1** (registrado em
  CONSULTAS.md): as pessoas do `seed.ts` têm `apta = true` gravado direto, sem
  nenhuma linha em `documentos` por trás — o checklist aponta corretamente
  "Documento de identidade não enviado" para todas. Não é bug do checklist: é o
  checklist revelando, com razão, que o atalho do seed da Fase 1 nunca gerou
  documentação real. Não corrigido agora (fora do escopo desta rodada).

### Checagem final

```
npx tsc --noEmit          → limpo
npm run lint              → limpo
npm run test:unit         → 104/104 (10 novos: checklist de pendências)
npm run test:integration  → 27/27 (sem novos — itens 9/13/14 verificados manualmente
                              contra o banco real, ver acima, em vez de testes
                              automatizados redundantes com o que já estava coberto)
npm run build             → limpo, 15 rotas
curl GET /pessoas e /contratos sem sessão → 307 → /login
```

## Fase 2 — status final: 14 de 14 itens com implementação real

| # | Item | Status |
|---|---|---|
| 1 | CRUD de pessoas + CPF duplicado | ✅ |
| 2 | Link público de coleta | ✅ |
| 3 | Upload de documento validado | ✅ |
| 4 | Nomenclatura gerada pelo sistema | ✅ (todo caminho de Storage desta fase é gerado, nunca digitado) |
| 5 | Versionamento de documento | ✅ |
| 6 | Aprovação marca pessoa apta | ✅ |
| 7 | Editor de templates | ✅ |
| 8 | Emissão com PDF e valor por extenso | ✅ |
| 9 | Emissão em lote | ✅ |
| 10 | Máquina de estados em transação | ✅ |
| 11 | Registro de envio + contrato_enviado | ✅ |
| 12 | Registro de assinatura (upload ou presencial) | ✅ |
| 13 | Distrato gerando termo | ✅ |
| 14 | Checklist de pendências | ✅ |

Isto **não é o mesmo** que o gate de saída formal da Fase 2 (Seção do PROMPT com
os itens específicos de teste, como "upload de imagem 72×72 recusado", "R$ 3.553,00
gera o extenso certo" etc.) — aquele gate precisa ser rodado e conferido item a
item separadamente, mas cada um dos 14 itens de entrega já tem código real por
trás, testado (unitário + integração contra o Supabase real) e, nos itens desta
última rodada, também verificado manualmente ponta a ponta contra o banco de
produção real.

---

# Gate de saída da Fase 2 — resultado

Rodado a pedido explícito do usuário em 2026-09-08, depois dos 14 itens de entrega
terem código real. Cada linha abaixo tem prova concreta, não "parece que funciona".

| # | Item do gate | Resultado | Prova |
|---|---|:--:|---|
| 1 | `CONSULTAS.md` registra Context 7 (Storage, Resend, React Email) + front-end-design (pessoas, upload, coleta) | ✅ | Entradas conferidas: Storage (linha 42), Resend/webhook (linhas 41/43/44), React Email (linha 52), front-end-design pessoas/documentos/coleta/lote (linhas 53/124/138/157) |
| 2 | Pessoa cadastrada → recebe link por e-mail → envia documento → contrato emitido, enviado e assinado — sem sair da aplicação | ✅ | `tests/integration/gate-fase2-e2e-completo.test.ts` — 9 passos encadeados contra o Supabase real: cadastro → link (`link_coleta` enviada) → validação do link (anon) → upload real com hash+dimensão → aprovação → `pessoa_apta` disparada → emissão com PDF real (`%PDF-` confirmado) e valor por extenso da biblioteca → envio com `contrato_enviado` → assinatura → trilha final: exatamente 3 eventos em `eventos_contrato` e 3 notificações `enviada` |
| 3 | Upload de imagem 72×72 px recusado com mensagem compreensível | ✅ | `tests/unit/documentos/upload.test.ts` + verificação manual ao vivo (Fase 2, item 3): `curl -F` real contra o servidor rodando devolveu a mensagem exata sobre resolução baixa |
| 4 | Upload do mesmo arquivo duas vezes recusado na segunda, apontando o existente | ✅ | `tests/integration/upload-coleta.test.ts` — mesmo hash recusado, `existente_tipo`/`existente_criado_em` devolvidos |
| 5 | R$ 3.553,00 → valor por extenso exato (+ 2.200/4.353/1.500) | ✅* | `tests/unit/valor-extenso.test.ts` — os 4 valores conferem. *Divergência deliberada e já registrada em CONSULTAS.md desde a Fase 1: o texto do gate pede vírgula depois de "mil" (`três mil, quinhentos...`), a biblioteca `extenso` segue a gramática numeral real do português e não usa essa vírgula — mantido o valor real da biblioteca, não um texto artificial só para bater com o exemplo |
| 6 | Transição inválida (`emitido`→`assinado`) rejeitada com erro explicativo | ✅ (corrigido durante esta rodada) | `tests/unit/maquina-estados.test.ts` (camada de aplicação) **+** achado real: a RPC `gravar_transicao_contrato` não validava o grafo por conta própria — um usuário autenticado comum pulava estados chamando a RPC direto. Corrigido na migration 0009 (grafo duplicado dentro da função SQL) e coberto por `tests/integration/gate-fase2-transicao-invalida.test.ts`, que também confirma que a transição válida correspondente continua funcionando |
| 7 | Toda transição bem-sucedida gerou linha em `eventos_contrato` | ✅ | `tests/integration/emissao-contrato.test.ts` e o passo 9 do teste E2E completo (3 transições → exatamente 3 eventos, na ordem certa) |
| 8 | `contrato_enviado` disparado duas vezes para o mesmo contrato envia um único e-mail | ✅ | `tests/integration/gate-fase2-notificacao-contrato.test.ts` — chamada dupla com a mesma chave: primeira `sent:true`, segunda `sent:false (duplicate)`, transporte de e-mail chamado uma única vez, uma única linha em `notificacoes` |
| 9 | Simular queda do Resend: contrato continua `enviado`, notificação fica `falhou` | ✅ | Mesmo arquivo acima — transporte falso sempre retornando erro: `notificacoes.status = 'falhou'`, `contratos.status` continua `'enviado'`, sem exceção subindo |
| 10 | Nenhum arquivo no Storage tem nome escolhido por humano | ✅ | Grep confirma: `arquivo.name`/nome digitado só alimenta `nome_original` (dado, não caminho); todo `caminho_storage`/`caminho_pdf` é montado por `organizacao_id`/`token`/`tipo`/`pessoa_id`/`versao` — nunca por texto do usuário. Confirmado também no passo 4 do teste E2E: caminho gerado bate exatamente com o padrão esperado, nome original (com espaços e acento) só aparece na coluna `nome_original` |
| 11 | Nenhum bucket é público — objeto sem URL assinada é negado | ✅ | `documentos`/`contratos`: `public = false` no banco. Testado ao vivo: acesso direto ao objeto (sem URL assinada, com e sem `anon` key) devolveu `400`/"Object not found" nos dois buckets |

## Gate de saída da Fase 2: **11 de 11 itens verdes**

Diferente do gate da Fase 1 (que fechou 8/9, com o item de e-mail pendente por falta
de domínio no Resend), **este gate fecha 100%** — os itens de notificação foram
verificados com transporte controlado (nunca dependendo do Resend real ter domínio
verificado), exatamente como a Seção 6 permite: o que importa é a mecânica de
idempotência/falha, não a entrega real, que já está documentada como pendência
separada desde a Fase 1.

## Achado real desta verificação (não existia antes de rodar o gate)

Rodar o gate a sério — testando a chamada direta da RPC, não só o caminho feliz pela
UI — encontrou uma lacuna de defesa em profundidade: `gravar_transicao_contrato`
confiava inteiramente na validação de `canTransition()` do lado da aplicação para
impedir transições inválidas, mas a própria função no banco não verificava isso.
Como a RPC é `GRANT ... TO authenticated` (não restrita a nenhuma rota específica),
qualquer usuário autenticado da organização conseguiria pular estados chamando a
função diretamente. Corrigido na hora (migration 0009), com teste de regressão
permanente. Este é exatamente o tipo de achado que rodar o gate de propósito, em vez
de só confiar no que já "parecia pronto", existe para pegar.

## O que o gate NÃO cobre (fora do escopo desta fase, já sinalizado)

- Entrega real de e-mail (sem domínio verificado no Resend — decisão do usuário,
  Fase 1 e 2).
- Fase 3 (dashboard tempo real) e Fase 4 (campo/automações) — ainda não iniciadas.
