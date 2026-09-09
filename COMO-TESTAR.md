# Como testar o Comitê Digital — roteiro completo antes de produção

> Este documento assume as Fases 1–4 fechadas (ver `PROGRESSO.md` e
> `PROGRESSO-FASE-2-3-4.md`). Cobre: checagem automatizada, teste funcional manual
> item a item, os 12 critérios de aceite da Seção 13 do `PROMPT-Comite-Digital.md`,
> as automações da Fase 4 e o passo a passo de publicação na Netlify.

---

## 0. Pré-requisitos

```bash
cd ~/Projetos/ComiteDigital
npm install
export $(grep -v '^#' .env.local | xargs)     # carrega as credenciais no shell
```

Rode a aplicação em um terminal e deixe aberto:

```bash
npm run dev            # http://localhost:3000
```

> **Um `next dev` por vez.** Antes de `npm run build`, mate qualquer `next dev`
> residual (`pkill -f "next dev"`), `rm -rf .next`, só então builde.

---

## 1. Checagem automatizada (cobertura mais ampla)

Os testes de integração e e2e rodam contra o **Supabase real** — não são mocks.

```bash
npm run lint                 # ESLint
npx tsc --noEmit             # TypeScript
npm run test:unit            # ~178 testes — lógica pura
npm run test:integration     # ~55 testes — RLS, transições, cron, expurgo, import (roda em série)
npm run build                # build de produção — 22 rotas
```

E2E (precisa do `npm run dev` rodando noutro terminal):

```bash
export $(grep -v '^#' .env.local | xargs) && npx playwright test
```

Cobre: login por e-mail + senha e a troca obrigatória no 1º acesso, fluxo de campo
offline em 360 px, OCR sem gravação sem confirmação.

Se algum teste de integração falhar **só no conjunto** e passar isolado, é
contenção da fixture compartilhada (a organização de teste é a mesma) — por isso o
script já roda com `--no-file-parallelism`.

---

## 2. Entrar no sistema

O login é por **e-mail + senha** (sem link mágico, sem e-mail no caminho crítico).
MFA/TOTP é **opcional** — camada extra da própria conta, em "Configurações →
Verificação em duas etapas".

### 2.1 Provisionar o primeiro gestor (bootstrap)

```bash
npm run db:provision-user -- voce@exemplo.com gestor "Seu Nome"
```

O comando imprime a **senha temporária**. Os demais usuários são criados pela tela
`/equipe` (que também mostra a senha temporária, uma única vez).

### 2.2 Migrar usuários antigos (uma vez, ao trocar do link mágico)

```bash
npm run db:reset-senhas                       # todos os usuários existentes
npm run db:reset-senhas -- apt.uplinux@gmail.com   # ou só alguns
```

Imprime a tabela `e-mail → senha temporária`. Todos caem na troca obrigatória no
próximo login.

### 2.3 Login

1. `http://localhost:3000/login` → e-mail + senha → **Entrar**.
2. Se a senha ainda é **temporária**, o sistema leva a `/definir-senha` — escolha
   uma senha (mín. 8) e continue. Só depois disso o painel abre.
3. `gestor`/`coord_comite` vão direto ao `/dashboard` (não há mais tela de MFA no
   fluxo de login).

### 2.4 Esqueci a senha

Não há autoatendimento. Um **gestor** redefine pelo `/equipe` → **Redefinir senha**
(gera nova temporária, mostrada uma vez). A senha do próprio gestor é redefinida
por `npm run db:provision-user -- <email> gestor` (redefine se o usuário já existe).

---

## 3. Roteiro funcional — os 12 critérios de aceite (Seção 13)

Faça como `coord_regiao` salvo indicação. Marque cada linha.

| # | Critério | Como provar |
| --- | --- | --- |
| 1 | Coordenador cadastra pessoa e coleta documentos pelo celular, sozinho | `/pessoas` → **+ Cadastrar Pessoa** (CPF com dígito verificador). Na linha da pessoa → **Gerar link de coleta** → abra o link `/coleta/[token]` (sem login, em 360 px) → preencha os dados complementares → envie uma **foto de documento** |
| 2 | Documento em resolução insuficiente é recusado no ato, com explicação | No `/coleta/[token]`, envie uma imagem **< 800 px** → mensagem clara de recusa |
| 3 | Contrato emitido por template, sem digitar valores, extenso correto | Como **gestor**: `/configuracoes` → crie um modelo com `{{nome}} {{valor}} {{valor_extenso}}`. `/contratos` → **Emitir** para a pessoa apta → abra o PDF: valor e extenso corretos (ex.: R$ 3.553,00 → "três mil quinhentos e cinquenta e três reais") |
| 4 | Envio para assinatura registrado com data e canal; contratado avisado | `/contratos` → **Enviar** → o status vai para `enviado`, com data/canal; uma linha `contrato_enviado` aparece em `notificacoes` |
| 5 | Gestor abre o dashboard e vê a matriz consolidada correta | `/dashboard` como gestor: matriz objeto×status, funil, regiões, pendências |
| 6 | Alteração de um coordenador aparece na tela do gestor em < 3 s | Abra `/dashboard` em duas abas (ou dois navegadores, gestor + coord). Mude um contrato numa → aparece na outra em segundos |
| 7 | Relatório em PDF exportado em um clique | `/dashboard` → **Exportar PDF** / **Exportar XLSX** |
| 8 | Distrato tira a pessoa do quadro ativo e a preserva na visão separada | `/contratos` de um contrato `assinado` → **Distratar** (com motivo) → some do quadro ativo, aparece na visão de distratos; o contrato original continua na base |
| 9 | Todo acesso a documento pessoal aparece no log de auditoria | `/documentos` → **Ver documento** de alguém → confira `select * from log_auditoria order by ocorrido_em desc` (SQL Editor do Supabase): linha `leitura_documento` |
| 10 | `coord_regiao` não vê dados de outra região, por nenhum caminho | Logado como `coord_regiao` de Águas Claras: em `/pessoas` só aparecem pessoas dessa região; tente abrir na URL o id de uma pessoa de Paranoá → negado. (No automatizado: `tests/integration/rls-isolamento.test.ts`) |
| 11 | Nenhum e-mail duplicado, mesmo com job rodando duas vezes | Seção 5 abaixo (job de vigência 2×) |
| 12 | Nenhum e-mail contém CPF, RG, endereço, dado bancário ou valor | Abra qualquer template em `src/emails/` — só primeiro nome, objeto e link. (No automatizado: os testes de `notificacoes`) |

**Teste definitivo (Seção 13):** rode o relatório consolidado do `/dashboard` e
compare com `SELECT COUNT` direto no banco — os números têm que bater
(`tests/integration` da Fase 3 já faz isso: 582 pessoas, matriz 1876).

---

## 4. Fase 4 — campo e automações

### 4.1 Registro de atividade em 3 toques + PWA offline
`/atividades` (no celular ou DevTools → 360 px):
1. Toque no **tipo** → ajuste a **quantidade** → **Registrar**. Aparece no histórico.
2. DevTools → Network → **Offline**. Registre de novo → banner "1 na fila", nada no banco.
3. Volte para **Online** → sobe sozinho, some da fila, o histórico recarrega.
4. DevTools → Application → Manifest → o app aparece **instalável**.

### 4.2 OCR de RG/CNH
`/pessoas` → **+ Cadastrar Pessoa** → **Preencher a partir de uma foto do RG ou CNH**
→ escolha uma foto. O OCR (roda no navegador) sugere nome/CPF em campos
**editáveis**; **"Usar estes dados"** só preenche o formulário. Nada é gravado até
você clicar em **Salvar**.

### 4.3 Rotas de cron protegidas
```bash
curl -i -X POST localhost:3000/api/cron/vigencia                                          # 401
curl -i -X POST -H "Authorization: Bearer $CRON_SECRET" localhost:3000/api/cron/vigencia  # 200
```
As 4 rotas: `/api/cron/{vigencia,lembrete-assinatura,resumo-diario,reprocessar-notificacoes}`.

### 4.4 Job de vigência: 2× no mesmo dia = 1 e-mail por contrato (critério 11)
1. Crie (ou ajuste) um contrato com `vigencia_fim` a exatamente **7 dias** de hoje,
   status `assinado`, e garanta que a organização tem um `gestor`.
2. `curl -X POST -H "Authorization: Bearer $CRON_SECRET" localhost:3000/api/cron/vigencia` — repita.
3. `select tipo, destinatario_email, count(*) from notificacoes where tipo='vigencia_a_vencer' group by 1,2;` → **uma linha por (contrato, destinatário)**, não duas.
   (Automatizado: `tests/integration/gate-fase4-cron.test.ts`.)

### 4.5 Fuso do resumo diário
`select jobname, schedule from cron.job where jobname='comite_resumo_diario';` →
deve ser `0 11 * * 1-5` (11:00 UTC = 08:00 America/Sao_Paulo).

### 4.6 Importação de planilha
`/pessoas` → **Importar planilha**. Monte um `.xlsx` com colunas `nome` e `cpf`
(o mesmo CPF em duas linhas + um CPF inválido) → a tela de conferência marca as
**duas** duplicatas e a linha ilegível **antes** de gravar. Só as prontas entram.

### 4.7 Expurgo de retenção
`/configuracoes` (gestor) → aba LGPD → **Expurgo de documentos pessoais**. Com a
campanha terminando em out/2026 + 180 dias de carência, hoje responde "nada a
expurgar ainda". (Automatizado: `tests/integration/expurgo-retencao.test.ts`.)

---

## 5. Administração (feedback do coordenador — itens 2, 3 e 4)

- **Regiões de Atuação** (`/regioes`, link no menu e no cabeçalho de `/pessoas`):
  como **gestor**, adicione uma região → ela aparece no seletor "Região de
  Atuação" do cadastro de pessoa. Renomeie inline. Não há exclusão (FK de
  pessoas/contratos). (Automatizado: `tests/e2e/server-actions.spec.ts`.)
- **Identidade do Comitê** (`/configuracoes` → primeira seção): como **gestor**,
  edite Nome e CNPJ → **Salvar identidade** → recarregue: persiste em
  `organizacoes`. CNPJ é validado por dígito verificador.
- **Tema**: o painel agora renderiza sempre no tema escuro, independente do modo
  do sistema operacional (antes, em modo claro, texto escuro ficava invisível
  sobre o fundo escuro fixo).

---

## 6. Publicar na Netlify

1. **Conectar o repositório** na Netlify. Ela detecta Next.js (App Router,
   Server Actions, Route Handlers e `middleware.ts` funcionam pelo Next Runtime).
2. **Variáveis de ambiente** (Site configuration → Environment variables) — as
   mesmas do `.env.local`, exceto:
   - `APP_URL` = a URL pública da Netlify (`https://SEU-SITE.netlify.app`).
   - Confira que `CRON_SECRET` está preenchida.
3. **Redirect URLs do Supabase**: no painel do Supabase → Authentication → URL
   Configuration → adicione `https://SEU-SITE.netlify.app` em **Site URL** e
   `https://SEU-SITE.netlify.app/**` em **Redirect URLs**.
4. **Deploy.** Depois do primeiro deploy, ative os jobs de cron rodando no
   **SQL Editor** do Supabase:
   ```sql
   select vault.update_secret(
     (select id from vault.secrets where name = 'comite_app_url'),
     'https://SEU-SITE.netlify.app');
   select vault.update_secret(
     (select id from vault.secrets where name = 'comite_cron_secret'),
     '<o mesmo valor de CRON_SECRET que você cadastrou na Netlify>');
   ```
5. **Verificar o cron**: force um job na hora e veja se chega:
   ```sql
   select cron.schedule('teste-agora', '* * * * *',
     $$select public.disparar_rota_cron('/api/cron/vigencia')$$);
   -- espere 1–2 min, confira a tabela `notificacoes` e `net._http_response`
   select cron.unschedule('teste-agora');
   ```

---

## 7. O que ainda falta para produção "de verdade"

| Item | Situação | O que fazer |
| --- | --- | --- |
| **E-mail transacional** | Servidor embutido do Supabase (~3–4/hora), sem SPF/DKIM/DMARC | Só afeta notificações (Resend), não o login (que é senha). Verificar um domínio no Resend para as notificações de contrato/coleta saírem de fato |
| **Login por senha / MFA opcional** | e-mail + senha; TOTP opcional; sem exigência de `aal2` no RLS (migration 0018) | Confirmar no painel do Supabase: Authentication → Providers → Email com "Confirm email" desligado; senha mínima. Rodar `db:reset-senhas` uma vez para os usuários legados |
| **Cron entregando de verdade** | Agendado no `pg_cron`; só alcança a app com URL pública | Passo 4 da Seção 5 acima |
| **Custom Access Token Hook** | Habilitado (a RLS funciona nos testes) | Confirmar no painel: Authentication → Hooks → Custom Access Token → `public.custom_access_token_hook` |
| **Buckets de Storage** | `documentos` e `contratos` privados, políticas por organização | Confirmar no painel: Storage → nenhum bucket público |
| **`_shot.mjs` / telas mockup** | Arquivos `??` da trilha de design paralela (`src/components/*`, `(painel)/layout.tsx`) | Não são código de fase; as telas reais dependem deles. Reconciliar o tema do painel (`(painel)/layout.tsx` escuro vs. tokens "papel oficial") antes de produção |
| **OCR offline** | `tesseract.js` busca ~5 MB do CDN | Auto-hospedar os assets se o cadastro precisar funcionar sem rede |
| **`/pessoas/importar`** | Carrega `exceljs` no cliente (258 kB) | Opcional: mover o parse para um Route Handler |
