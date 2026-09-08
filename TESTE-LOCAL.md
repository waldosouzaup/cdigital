# Testar o sistema em localhost — passo a passo

> Leia isto antes de testar: **nem toda tela que você vai ver é real ainda.** Ver a
> seção 3 antes de estranhar um número que não muda quando você mexe no banco.

---

## 1. Pré-requisitos

- Node.js 20+ (o projeto foi testado com Node 22).
- O arquivo `.env.local` na raiz já está preenchido (URL do Supabase, chaves,
  `DATABASE_URL`, `RESEND_API_KEY`). **Não commite esse arquivo** — ele já está no
  `.gitignore`.

## 2. Instalar e rodar

```bash
cd comite-digital   # ou o caminho onde você clonou o projeto
npm install
npm run dev
```

Abra **http://localhost:3000**. O terminal mostra `Environments: .env.local`
confirmando que as variáveis foram carregadas.

Para parar: `Ctrl+C` no terminal onde o `npm run dev` está rodando.

---

## 3. O que é real e o que é mockup, hoje

O projeto tem duas partes em estágios bem diferentes agora:

| Rota                                                                                                           | Estado                                         | O que significa                                                                                                                                                                                                                                                 |
| -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/login`                                                                                                       | **Real** — fala com o Supabase Auth de verdade | Digitar um e-mail cadastrado envia um link mágico de verdade                                                                                                                                                                                                    |
| `/verificacao`                                                                                                 | **Real**                                       | Tela de "confira seu e-mail", com botão de reenviar que também é real                                                                                                                                                                                           |
| `/mfa`                                                                                                         | **Real**                                       | Cadastro/verificação de TOTP contra o Supabase Auth de verdade                                                                                                                                                                                                  |
| `/`, `/dashboard`, `/pessoas`, `/contratos`, `/documentos`, `/atividades`, `/configuracoes`, `/coleta/[token]` | **Mockup visual**                              | Dados fixos escritos no próprio código (`useState` com um array de exemplo) — **não vêm do banco**. Editar uma pessoa, mudar o status de um contrato etc. muda só o estado local da página no seu navegador; recarregar a página volta tudo ao exemplo original |

Ou seja: hoje dá para **ver o design** de todas as telas, mas só o **login** é
funcional de ponta a ponta contra o Supabase real. Ligar as telas de
Pessoas/Contratos/Documentos/Atividades/Configurações ao banco de verdade é
trabalho de Fase 2/3 (ver `PROMPT-Comite-Digital.md`), que ainda não fechou a
Fase 1 — ver `PROGRESSO.md` para o estado exato do gate.

---

## 4. Testar o login de verdade

Já existe um usuário real provisionado como **gestor**: `apt.uplinux@gmail.com`
(organização "Comitê Michelle — Eleição 2026").

1. Em `/login`, digite `apt.uplinux@gmail.com` → **Enviar link de acesso**.
2. Você cai em `/verificacao`. Confira a caixa de entrada **daquele e-mail**.
   - ⚠️ **O SMTP ainda não foi apontado para o Resend** (passo "c" do
     `ACESSO.md`) — o Supabase está usando o servidor de e-mail padrão dele
     próprio, que tem limite baixo de envio e às vezes cai em spam/lixo
     eletrônico. Se não chegar em alguns minutos, confira o spam antes de
     desconfiar de bug.
3. Clique no link recebido. Ele te traz de volta à aplicação, autenticado.
4. Como é a primeira vez desse usuário (papel `gestor`), você cai em `/mfa` no
   modo **cadastro**: escaneie o QR code com um app autenticador (Google
   Authenticator, Authy, etc.) e digite o código de 6 dígitos gerado.
5. **Aqui é onde o bloqueio atual aparece:** mesmo com o código certo, qualquer
   leitura de dado real (não as telas mockup) vai ser negada pelo RLS, porque o
   **Custom Access Token Hook ainda não foi habilitado** no painel do Supabase
   (`ACESSO.md`, passo "a") — o JWT sai sem a claim `organizacao_id`/`papel`, e a
   política de banco nega tudo por padrão. Isso é comportamento **de segurança
   correto**, não bug: o sistema erra para o lado de não vazar dado.
6. Depois que o hook estiver habilitado (ver `ACESSO.md`), me avise — eu rodo os
   testes de isolamento reais (`tests/integration/rls-isolamento.test.ts`) e
   confirmamos que Organização A não vê nada de B, e que `coord_regiao` só vê a
   própria região.

## 5. Rodar os testes e verificações automatizadas

```bash
npm run lint          # ESLint — inclui a regra que proíbe admin.ts em (painel)
npx tsc --noEmit       # TypeScript
npm run build          # build de produção — pega erro que o dev não pega
npm run test:unit      # 59 testes de unidade (máquina de estados, CPF, valor por extenso...)
npm run test:integration   # testes contra o Supabase real (webhook + RLS)
```

Hoje (checado nesta sessão): lint, tsc e build passam limpos; 59/59 unitários
passam; dos testes de integração, o de assinatura de webhook passa, e o de
isolamento de RLS falha **especificamente** nas 3 asserções que dependem do hook
estar habilitado (ver seção 4, item 5) — o resto da infraestrutura do teste (criar
usuário, logar de verdade, etc.) já funciona.

## 6. Provisionar outra pessoa para testar com outro papel

```bash
npm run db:provision-user -- email@exemplo.com gestor
npm run db:provision-user -- email@exemplo.com coord_comite
npm run db:provision-user -- email@exemplo.com coord_regiao "Águas Claras"
```

(`coord_regiao` exige o nome de uma região existente como último argumento —
qualquer uma das 10 localidades ou "Comitê", semeadas na Seção 11.)

---

## 7. Sobre a hospedagem na Netlify

Registrado como decisão de projeto (não estava no `PROMPT-Comite-Digital.md`, que
não especifica plataforma de hospedagem). Pontos de atenção para quando chegarmos
lá — nada disto foi configurado ainda:

- A Netlify roda Next.js App Router através do **Next Runtime** oficial dela
  (detecção automática ao conectar o repositório) — suporta Server Actions, Route
  Handlers e `middleware.ts` como está.
- As variáveis de ambiente (as mesmas do `.env.local`) precisam ser cadastradas em
  **Site configuration → Environment variables** no painel da Netlify — o
  `.env.local` nunca vai para lá, é só local.
- `middleware.ts` roda como Edge Function na Netlify — o `getClaims()` que usamos
  (Context 7 confirmou ser o método certo para isso) funciona em runtime Edge.
- Vale conferir mais perto da hora se o **CRON_SECRET** e as rotas de
  `/api/cron/*` (Fase 4, pg_cron) precisam de alguma configuração adicional de
  agendamento na Netlify (ela tem "Scheduled Functions" próprias) — isso ainda
  não foi desenhado.

Nada disto bloqueia o teste em localhost de agora.
