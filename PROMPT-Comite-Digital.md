# Prompt de construção — Comitê Digital

**Versão 1.2** — Supabase (banco, auth, storage, tempo real), Resend (e-mail transacional) e uso
obrigatório das skills Superpowers, Context 7 e front-end-design.

> **Como usar este arquivo.** Crie uma pasta vazia, salve este arquivo dentro dela como
> `PROMPT-Comite-Digital.md`, abra o Claude Code nessa pasta e envie:
>
> ```
> Leia PROMPT-Comite-Digital.md por inteiro. Antes de codar, cumpra a Seção 2.1
> (Superpowers, Context 7 e front-end-design) e crie CONSULTAS.md. Depois execute
> a Fase 1. Não avance para a Fase 2 sem rodar o gate de saída e me mostrar o resultado.
> ```
>
> A cada fase concluída, peça a próxima da mesma forma. Este arquivo é a fonte da verdade
> do projeto: quando houver conflito entre o que está aqui e uma decisão improvisada
> durante a implementação, este arquivo vence.

---

## 1. Missão

Construir o **Comitê Digital**: um SaaS multi-organização para gestão de equipe temporária,
contratos por período determinado e prestação de contas — com alimentação contínua de dados
pela equipe de campo e painel em tempo real para o gestor.

O primeiro domínio atendido é o de **comitês de campanha eleitoral**, mas o modelo de dados
deve permanecer neutro o bastante para atender obras, eventos e ações promocionais sem
reescrita.

### O problema que justifica cada decisão

O sistema nasce de um diagnóstico real. Hoje a operação vive em pastas compartilhadas, e isso
produz um conjunto específico de falhas. **Cada uma delas tem um requisito correspondente
neste documento — quando estiver em dúvida sobre uma decisão de implementação, volte aqui e
escolha a opção que impede a falha:**

| Falha observada | O que a causa |
|---|---|
| Relatório exigiu abrir 40+ PDFs em 9 pastas | Não existe dado estruturado, só arquivo |
| A coluna "contrato enviado" ficou impossível de preencher | O estado intermediário não é capturado em lugar nenhum |
| Arquivo `Eduardo_assinado.pdf` continha o contrato de *Ricardo Ribeiro* | O nome do arquivo é escolhido por humano e não é verificado |
| 19 documentos nomeados por UUID | Idem |
| Pares `Rg.pdf` / `Rg(1).pdf` | Nenhuma detecção de duplicata |
| 6 documentos de identidade com 72×72 px | Nenhuma validação de qualidade no upload |
| `R$ R$ 3.553,00,00` e "dois mil e duzentos e reais" em contratos | Contrato digitado à mão no Word |
| CPF/RG/CNH em pasta aberta, sem log | Nenhum controle de acesso |
| Pastas com espaço no fim do nome quebraram a automação | Humano nomeia arquivo e pasta |
| Ninguém foi avisado de contrato pendente ou vigência a vencer | Nenhuma notificação automática |

**Princípio central que resolve quase tudo:** o estado nunca é representado pela localização de
um arquivo. Estado é coluna em tabela, com transição registrada. Arquivo é anexo de uma
entidade, com nome gerado pelo sistema. E toda mudança que exige ação humana dispara um aviso.

---

## 2. Regras de trabalho (leia antes de escrever qualquer código)

0. **Consulte as skills obrigatórias da Seção 2.1 antes de codar.** Esta regra vem antes de todas as outras.
1. **Trabalhe em fases.** Não comece a Fase N+1 antes do gate de saída da Fase N passar.
2. **Toda fase termina com o gate rodando verde.** O gate é um comando, não uma opinião.
3. **Não invente requisito.** Se algo necessário não estiver especificado aqui, pare e pergunte.
4. **Escreva o teste junto com a funcionalidade**, não depois. Sem teste, a tarefa não está pronta.
5. **Commits pequenos e descritivos**, um por tarefa concluída, em português.
6. **Não instale dependência fora da lista da Seção 3** sem justificar antes.
7. **Nada de dado sensível em log, em mensagem de erro, em nome de arquivo ou em corpo de e-mail.**
8. **Idioma:** interface, mensagens de erro, nomes de tabela e coluna em **português**.
   Nomes de variável, função e tipo em **inglês**. Comentários em português.
9. Ao final de cada fase, atualize `PROGRESSO.md` com o que ficou pronto e o que ficou pendente.

### 2.1 Skills obrigatórias

Este projeto usa três skills instaladas no Claude Code. **Não são opcionais e não são sugestões
de leitura**: são etapas do trabalho. Codar sem consultá-las é considerado tarefa não concluída,
mesmo que o código funcione.

| Skill | Quando consultar — sempre | O que ela impede |
|---|---|---|
| **Superpowers** | No início de **cada fase**, e antes de qualquer tarefa não trivial (arquitetura, refatoração, decisão de modelagem) | Improviso de estrutura e perda da disciplina de teste |
| **Context 7** | Antes de escrever **a primeira linha de código contra qualquer biblioteca externa**, e sempre que uma API não se comportar como esperado | API inventada de memória e uso de sintaxe obsoleta |
| **front-end-design** | Antes de criar **qualquer tela, componente ou fluxo visual** | Interface improvisada, inconsistente e sem hierarquia |

#### Superpowers

No começo de cada fase, liste as skills disponíveis no Superpowers e identifique as aplicáveis à
fase. Siga o fluxo que ela definir para planejamento, decomposição de tarefas e disciplina de
teste. Quando o Superpowers oferecer um caminho diferente do que você faria por conta própria,
**siga o do Superpowers** — se ele conflitar com uma regra deste arquivo, pare e pergunte em vez
de escolher sozinho.

#### Context 7 — a mais crítica deste projeto

A stack da Seção 3 é composta quase inteiramente por bibliotecas que mudaram muito nos últimos
meses. Documentação desatualizada aqui não gera erro de compilação: gera código que roda e está
errado — e no caso do RLS do Supabase, gera vazamento silencioso entre organizações.

**Consulte o Context 7 obrigatoriamente antes de tocar em cada uma destas:**

`@supabase/supabase-js` · Supabase Auth (MFA e Custom Access Token Hook) · Supabase Storage ·
Supabase Realtime · políticas de RLS · Supabase CLI · `pg_cron` e Edge Functions ·
Next.js 15 App Router (Server Actions, Route Handlers, `cookies()`) · Drizzle ORM ·
Resend SDK · React Email · Playwright · `sharp` · `tesseract.js`

Regras de uso:

- Pergunte pela versão que o `package.json` realmente instalou, não pela "mais recente".
- Se o Context 7 divergir do que você ia escrever, **o Context 7 vence**.
- Se o Context 7 não cobrir o caso, diga isso explicitamente no registro e vá à documentação oficial — nunca preencha a lacuna de memória.

#### front-end-design

Consulte antes de qualquer trabalho visual, e observe que este produto tem três contextos de uso
muito diferentes, que a skill precisa endereçar separadamente:

1. **Painel do gestor** — leitura rápida, densidade alta, números clicáveis até o documento.
2. **Operação do coordenador** — trabalho repetitivo: emitir, enviar, cobrar, conferir.
3. **Campo, no celular** — uma só mão, pressa, sinal ruim, viewport de 360 px, registro em 3 toques.

O link público de coleta (`/coleta/[token]`) é usado por alguém que nunca viu o sistema, sem
login e sem treinamento. É a tela que mais precisa da skill, não a que menos.

#### Registro obrigatório de consulta

Toda skill consultada gera uma linha em **`CONSULTAS.md`**, na raiz do projeto:

```markdown
| Data | Fase | Skill | O que perguntei | O que mudou por causa da resposta |
|------|------|-------|-----------------|-----------------------------------|
| 2026-09-07 | 1 | Context 7 | API atual do Custom Access Token Hook | Troquei o hook por Edge Function; a assinatura mudou na v2 |
```

A coluna **"o que mudou"** é a que importa. Se a resposta não mudou nada, escreva
`nada — confirmou a abordagem`. Um `CONSULTAS.md` em que nada nunca muda é sinal de que as
skills não estão sendo realmente consultadas, e isso reprova o gate.

### O que NÃO fazer

- Não escrever código contra biblioteca externa sem antes consultar o Context 7.
- Não criar tela sem antes consultar o front-end-design.
- Não iniciar fase sem antes consultar o Superpowers.
- Não criar tela de "gerenciar pastas" — pasta não é conceito do produto.
- Não permitir que o usuário digite o nome de um arquivo enviado.
- Não implementar assinatura eletrônica própria (fora do MVP).
- Não implementar folha de pagamento, emissão fiscal ou integração com o TSE.
- Não criar aplicativo nativo — a entrega é web responsiva, instalável como PWA.
- Não gerar valor por extenso com código próprio: use biblioteca.
- **Não usar a `service_role` key do Supabase em código que atende requisição de usuário.** Veja a Seção 3.1.
- Não colocar CPF, RG, endereço ou valor de contrato no corpo de e-mail. Veja a Seção 6.

---

## 3. Stack fechada

| Camada | Escolha | Motivo |
|---|---|---|
| Banco | **Supabase** (PostgreSQL 15+) | Plataforma escolhida pelo cliente |
| Auth | **Supabase Auth** — link mágico + MFA TOTP nativo | Já integrado ao RLS via `auth.uid()` |
| Storage | **Supabase Storage**, buckets privados, URLs assinadas | Elimina infra de S3 própria |
| Tempo real | **Supabase Realtime** (Postgres Changes) | Canal nativo, sem serviço extra, e respeita RLS |
| Agendamento | **pg_cron** do Supabase chamando **Edge Function** | Alertas de vigência e resumo diário |
| E-mail | **Resend** + **React Email** | E-mail transacional e templates versionados em código |
| Frontend | Next.js 15 (App Router) + TypeScript + Tailwind | SSR para conexão móvel ruim; PWA |
| Backend | Route Handlers + Server Actions do Next | Um só runtime |
| ORM | **Drizzle ORM** apontando para o Postgres do Supabase | Migrations versionadas e SQL previsível |
| PDF | Template HTML + Playwright/Chromium headless | Fidelidade tipográfica alta |
| OCR | `tesseract.js` | Extração de CPF e nome de RG/CNH |
| Imagem | `sharp` | Dimensões, normalização e miniaturas |
| Extenso | `extenso` (pt-BR) | **Nunca escrever valor por extenso à mão** |
| Testes | Vitest (unidade) + Playwright (e2e) | — |
| Ambiente local | **Supabase CLI** (`supabase start`) | Sobe Postgres, Auth, Storage e Realtime local |

### 3.1 Armadilhas do Supabase que este projeto precisa evitar

Leia esta seção **antes** de escrever a primeira migration. São quatro erros comuns, e três
deles produzem vazamento de dados entre organizações sem nenhum sintoma visível.

**1. `service_role` ignora RLS por completo.**
A chave `service_role` bypassa toda política de segurança. Se o Drizzle conectar com ela, o
isolamento multi-tenant simplesmente não existe — e a aplicação parece funcionar
perfeitamente. Regra do projeto:

- Requisição de usuário → cliente Supabase com a **anon key** e o JWT do usuário. RLS ativo.
- `service_role` só é permitida em: seed, migrations, jobs do pg_cron e webhooks. Nunca em rota que atende usuário.
- Isole a `service_role` em `src/lib/supabase/admin.ts`, com um comentário no topo explicando a restrição, e **proíba a importação desse arquivo** dentro de `src/app/(painel)/` via regra de ESLint (`no-restricted-imports`).

**2. RLS precisa do `organizacao_id` dentro do JWT.**
Uma política que faz subconsulta em `usuarios` a cada linha é lenta e pode recursar. Use o
**Custom Access Token Hook** do Supabase Auth para injetar `organizacao_id`, `papel` e
`regiao_id` como claims, e leia-os na política:

```sql
CREATE OR REPLACE FUNCTION auth.organizacao_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claims', true)::json->>'organizacao_id','')::uuid
$$;
```

**Consequência importante:** claims só entram no token na emissão. Se o papel ou a região de um
usuário mudar, **force a renovação da sessão dele** — caso contrário ele continua com a permissão
antiga até o token expirar. Trate isso explicitamente ao editar um usuário.

**3. Realtime respeita RLS, mas só se você habilitar.**
Adicione cada tabela à publicação e confirme que a política vale também para a assinatura:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE contratos, pessoas, registros_atividade;
```

Sem RLS válido no Realtime, um coordenador de região recebe eventos de outra região pelo
socket, mesmo que a tela nunca mostre.

**4. Bucket de Storage é público por padrão em muitos exemplos.**
Aqui **todos os buckets são privados**. O acesso se dá exclusivamente por URL assinada com
validade máxima de 15 minutos, gerada no servidor após a checagem de permissão. Aplique
políticas de Storage por `organizacao_id`, usando o primeiro segmento do caminho do objeto.

### 3.2 Variáveis de ambiente

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # nunca exposta ao cliente; uso restrito (ver 3.1)
DATABASE_URL=                     # conexão do Drizzle para migrations

# Resend
RESEND_API_KEY=
RESEND_FROM="Comitê Digital <nao-responda@seudominio.com.br>"
RESEND_REPLY_TO=
RESEND_WEBHOOK_SECRET=

# App
APP_URL=
CRON_SECRET=                      # protege as rotas chamadas pelo pg_cron
```

Gere `.env.example` com todas as chaves vazias e **nunca** versione `.env.local`.

---

## 4. Estrutura de pastas alvo

```
comite-digital/
├── supabase/
│   ├── config.toml
│   ├── migrations/               schema, RLS, policies de storage, pg_cron
│   └── functions/                Edge Functions (alertas, resumo diário)
├── PROGRESSO.md
├── src/
│   ├── app/
│   │   ├── (auth)/               login, verificação, MFA
│   │   ├── (painel)/             área autenticada
│   │   │   ├── dashboard/
│   │   │   ├── pessoas/
│   │   │   ├── contratos/
│   │   │   ├── documentos/
│   │   │   ├── atividades/
│   │   │   └── configuracoes/
│   │   ├── coleta/[token]/       link público de coleta (sem login)
│   │   └── api/
│   │       ├── cron/             rotas protegidas por CRON_SECRET
│   │       └── webhooks/resend/  eventos de entrega e bounce
│   ├── db/
│   │   ├── schema.ts             Drizzle
│   │   └── seed.ts
│   ├── emails/                   templates React Email
│   ├── lib/
│   │   ├── supabase/             client.ts, server.ts, admin.ts
│   │   ├── contratos/            máquina de estados, geração de PDF
│   │   ├── documentos/           validação, hash, OCR
│   │   ├── notificacoes/         envio via Resend, idempotência, retry
│   │   ├── realtime/
│   │   └── auditoria/
│   └── components/
└── tests/
    ├── unit/
    └── e2e/
```

---

## 5. Modelo de dados

Enums:

```sql
CREATE TYPE papel_usuario AS ENUM
  ('gestor','coord_comite','coord_regiao','contratado','auditor');

CREATE TYPE status_contrato AS ENUM
  ('rascunho','emitido','enviado','assinado','distratado','distrato_assinado','encerrado','cancelado');

CREATE TYPE status_documento AS ENUM ('pendente','aprovado','rejeitado');

CREATE TYPE canal_envio AS ENUM ('email','whatsapp','presencial');

CREATE TYPE status_notificacao AS ENUM
  ('enfileirada','enviada','entregue','falhou','bounce','reclamada');

CREATE TYPE tipo_notificacao AS ENUM
  ('link_coleta','documento_rejeitado','contrato_enviado','lembrete_assinatura',
   'vigencia_a_vencer','resumo_diario','pessoa_apta');
```

Tabelas (campos essenciais; adicione `id uuid pk`, `criado_em`, `atualizado_em` em todas):

- **organizacoes** — `nome`, `cnpj`, `ativa`
- **usuarios** — `id` referenciando `auth.users(id)`, `organizacao_id`, `nome`, `email`, `papel`, `regiao_id` (nulo exceto para `coord_regiao`)
- **regioes** — `organizacao_id`, `nome`
- **pessoas** — `organizacao_id`, `nome_completo`, `cpf` (**único por organização**), `rg`, `data_nascimento`, `endereco`, `cep`, `telefone`, `email`, `regiao_id`, `funcao`, `banco`, `agencia`, `conta`, `apta boolean`
- **templates_contrato** — `organizacao_id`, `nome`, `objeto`, `corpo_html`, `valor_padrao`, `ativo`
- **contratos** — `organizacao_id`, `pessoa_id`, `template_id`, `objeto`, `valor numeric(12,2)`, `valor_extenso`, `vigencia_inicio`, `vigencia_fim`, `status status_contrato`, `emitido_em`, `enviado_em`, `canal_envio`, `enviado_para`, `assinado_em`
- **eventos_contrato** — `contrato_id`, `status_anterior`, `status_novo`, `usuario_id`, `observacao`, `ocorrido_em` — **somente inserção**
- **documentos** — `organizacao_id`, `pessoa_id`, `tipo`, `caminho_storage`, `nome_original`, `hash_sha256`, `largura_px`, `altura_px`, `bytes`, `status status_documento`, `motivo_rejeicao`, `versao int`
- **registros_atividade** — `organizacao_id`, `pessoa_id`, `regiao_id`, `data`, `tipo`, `quantidade`, `foto_caminho`, `observacao`, `sincronizado_em`
- **links_coleta** — `organizacao_id`, `pessoa_id`, `token` (único), `expira_em`, `usado_em`
- **notificacoes** — `organizacao_id`, `tipo tipo_notificacao`, `destinatario_email`, `entidade`, `entidade_id`, `chave_idempotencia` (**única**), `resend_id`, `status status_notificacao`, `tentativas int`, `erro`, `enviada_em`
- **log_auditoria** — `organizacao_id`, `usuario_id`, `acao`, `entidade`, `entidade_id`, `ip`, `ocorrido_em` — **somente inserção**

### Regras de integridade obrigatórias

```sql
-- CPF único por organização (impede a duplicata que hoje passa despercebida)
CREATE UNIQUE INDEX ON pessoas (organizacao_id, cpf);

-- Documento idêntico não entra duas vezes
CREATE UNIQUE INDEX ON documentos (organizacao_id, hash_sha256);

-- Cada notificação é enviada uma única vez
CREATE UNIQUE INDEX ON notificacoes (chave_idempotencia);

-- Vigência coerente
ALTER TABLE contratos ADD CONSTRAINT vigencia_valida CHECK (vigencia_fim >= vigencia_inicio);
ALTER TABLE contratos ADD CONSTRAINT valor_positivo CHECK (valor > 0);
ALTER TABLE contratos ADD CONSTRAINT ordem_datas
  CHECK (enviado_em IS NULL OR emitido_em IS NULL OR enviado_em >= emitido_em);
```

RLS ligado em **todas** as tabelas com `organizacao_id`, usando `auth.organizacao_id()` da
Seção 3.1. Adicionalmente, `coord_regiao` só enxerga linhas da própria região.

---

## 6. Notificações por e-mail (Resend)

O produto avisa; ninguém precisa lembrar de cobrar. Toda notificação passa por
`src/lib/notificacoes/` e **grava linha em `notificacoes` antes de chamar a API do Resend**.

| Tipo | Quando dispara | Para quem | Conteúdo |
|---|---|---|---|
| `link_coleta` | Coordenador gera o link | Contratado | Link e prazo. Nada além do primeiro nome. |
| `documento_rejeitado` | Upload reprovado na validação | Contratado | Motivo em linguagem simples e link para reenviar |
| `contrato_enviado` | Transição `emitido` → `enviado` | Contratado | Aviso de que há contrato a assinar + link |
| `lembrete_assinatura` | 3 dias em `enviado` sem assinar | Contratado, com cópia ao coordenador | Lembrete |
| `vigencia_a_vencer` | 7 e 3 dias do término | Gestor e coord. do comitê | Quantidade e link para a lista |
| `pessoa_apta` | Documentação completa e aprovada | Coordenador responsável | Pessoa liberada para contrato |
| `resumo_diario` | Todo dia útil às 8h (America/Sao_Paulo) | Gestor | O que mudou em 24 h e pendências críticas |

### Regras não negociáveis

1. **Idempotência.** `chave_idempotencia` é determinística, por exemplo
   `contrato_enviado:{contrato_id}` ou `vigencia_a_vencer:{contrato_id}:7d`. Antes de enviar,
   tente inserir; se o índice único recusar, **não envie**. É isso que impede o cliente receber
   o mesmo aviso cinco vezes quando um job roda de novo.
2. **Sem dado sensível no corpo.** Nunca CPF, RG, endereço, dado bancário ou valor de contrato.
   O e-mail leva a pessoa até a aplicação; o dado fica lá dentro, atrás de autenticação.
3. **Falha de e-mail nunca derruba a operação principal.** O envio ocorre depois do commit da
   transação de negócio. Se o Resend falhar, a notificação fica `falhou`, com `tentativas`
   incrementado, e um job tenta de novo — o contrato continua emitido.
4. **Retry com recuo exponencial**, no máximo 3 tentativas. Depois disso, aparece na central de
   pendências do painel.
5. **Webhook do Resend** em `/api/webhooks/resend`, com assinatura verificada, atualizando
   `status` para `entregue`, `bounce` ou `reclamada`. Endereço com bounce permanente é marcado
   na pessoa e sinalizado ao coordenador — endereço errado é a causa mais comum de "não recebi".
6. **Domínio verificado** com SPF, DKIM e DMARC. Sem isso o e-mail cai em spam e a
   funcionalidade existe apenas no papel.
7. **Em desenvolvimento, não envie para endereço real.** Use o modo de teste do Resend ou uma
   caixa de captura.

Templates em `src/emails/` com **React Email**, em português, assunto curto e objetivo, um
único botão de ação, versão em texto puro sempre presente.

O **link mágico de login** do Supabase Auth também sai pelo Resend: configure SMTP customizado
no Supabase apontando para o Resend, para que autenticação e notificação saiam do mesmo domínio
verificado.

---

## 7. Máquina de estados do contrato

```
rascunho ──► emitido ──► enviado ──► assinado ──► encerrado
    │           │           │            │
    │           │           │            └──► distratado ──► distrato_assinado
    │           │           │
    └──── cancelado ◄───────┘
```

Transições permitidas — qualquer outra deve ser **rejeitada com erro explicativo**:

| De | Para |
|---|---|
| `rascunho` | `emitido`, `cancelado` |
| `emitido` | `enviado`, `cancelado` |
| `enviado` | `assinado`, `cancelado` |
| `assinado` | `distratado`, `encerrado` |
| `distratado` | `distrato_assinado` |
| `distrato_assinado` / `encerrado` / `cancelado` | — |

Implemente como função pura testável, `podeTransicionar(de, para): boolean`. **Toda** transição
bem-sucedida grava linha em `eventos_contrato` **na mesma transação**. A notificação
correspondente é disparada **após** o commit.

**Regra de contagem do quadro ativo:** `emitido`, `enviado` e `assinado`. Os estados de distrato
formam visão separada e nunca entram no total ativo.

---

## 8. Papéis e permissões

| Ação | gestor | coord_comite | coord_regiao | contratado | auditor |
|---|:--:|:--:|:--:|:--:|:--:|
| Ver dashboard consolidado | ✅ | ✅ | própria região | ❌ | ✅ |
| Cadastrar pessoa | ✅ | ✅ | própria região | ❌ | ❌ |
| Gerar link de coleta | ✅ | ✅ | ✅ | ❌ | ❌ |
| Enviar documento | ✅ | ✅ | ✅ | via link | ❌ |
| Emitir contrato | ✅ | ✅ | ❌ | ❌ | ❌ |
| Registrar envio/assinatura | ✅ | ✅ | ❌ | ❌ | ❌ |
| Registrar distrato | ✅ | ✅ | ❌ | ❌ | ❌ |
| Editar templates | ✅ | ❌ | ❌ | ❌ | ❌ |
| Exportar relatórios | ✅ | ✅ | própria região | ❌ | ✅ |
| Ler log de auditoria | ✅ | ❌ | ❌ | ❌ | ✅ |

`coord_regiao` **nunca** pode enxergar dado de outra região, por nenhum caminho — nem por filtro
de URL, nem por chamada de API, nem pelo canal do Realtime. Isso é item de gate.

---

## 9. Fases de implementação

### Fase 1 — Fundação

**Entregar**

1. Projeto Supabase local via CLI (`supabase start`) subindo Postgres, Auth, Storage e Realtime.
2. Next.js 15 + TypeScript + Tailwind, com ESLint e Prettier.
3. Schema completo da Seção 5 em Drizzle, com migrations em `supabase/migrations/`.
4. RLS ativo em todas as tabelas com `organizacao_id`, usando `auth.organizacao_id()`.
5. **Custom Access Token Hook** injetando `organizacao_id`, `papel` e `regiao_id` no JWT.
6. Supabase Auth com link mágico; **MFA TOTP obrigatório** para `gestor` e `coord_comite`.
7. Buckets privados `documentos` e `contratos`, com políticas por organização.
8. Clientes Supabase separados: `client.ts`, `server.ts` e `admin.ts` — com a regra de ESLint que impede importar `admin.ts` dentro de `(painel)`.
9. Resend configurado, domínio verificado, `notificacoes` funcionando com um tipo de teste ponta a ponta.
10. Log de auditoria gravando em toda leitura de documento e toda escrita em `pessoas` e `contratos`.
11. `seed.ts` com os dados da Seção 11.

**Gate de saída — todos verdes**

```bash
supabase start && npm run db:migrate && npm run db:seed
npm run test:unit
npm run lint
```

- [ ] **`CONSULTAS.md` existe e registra o Superpowers no início da fase e o Context 7 para Supabase Auth, RLS, Storage, Next.js 15 e Drizzle.**
- [ ] Ambiente sobe do zero com um comando.
- [ ] Teste prova que usuário da organização A não lê nenhuma linha da organização B **usando a anon key com o JWT real**.
- [ ] Teste prova que `coord_regiao` da região X não lê pessoa da região Y.
- [ ] `npm run lint` **falha** se alguém importar `admin.ts` dentro de `(painel)` — prove quebrando de propósito.
- [ ] Alterar o papel de um usuário força renovação da sessão dele.
- [ ] CPF repetido na mesma organização falha com erro tratado.
- [ ] Login sem TOTP é recusado para `gestor`.
- [ ] Um e-mail de teste chega pelo Resend e a linha em `notificacoes` vai para `entregue` via webhook.

---

### Fase 2 — Pessoas, documentos e contratos

**Entregar**

1. CRUD de pessoas com validação de CPF por dígito verificador; CPF duplicado exibe o registro existente em vez de criar outro.
2. Link público de coleta (`/coleta/[token]`) — sem login, validade configurável, expiração no uso. Enviado por e-mail (`link_coleta`).
3. Upload no Supabase Storage com **validação síncrona** antes de aceitar:
   - menor dimensão da imagem `>= 800px`, senão rejeita informando o motivo em linguagem simples e dispara `documento_rejeitado`;
   - `hash_sha256` calculado — colisão dentro da organização é recusada apontando o documento existente;
   - tipos JPG, PNG, PDF; limite de 20 MB; resposta em até 5 segundos.
4. **Nomenclatura gerada pelo sistema**: `{organizacao_id}/{tipo}_{pessoa_id}_v{versao}.{ext}`. O nome original vai para `nome_original` e nunca vira caminho.
5. Versionamento: reenvio cria `versao + 1` e preserva a anterior.
6. Documentação completa e aprovada marca a pessoa como apta e dispara `pessoa_apta`.
7. Editor de templates com marcadores `{{nome}}`, `{{cpf}}`, `{{endereco}}`, `{{objeto}}`, `{{valor}}`, `{{valor_extenso}}`, `{{vigencia_inicio}}`, `{{vigencia_fim}}`.
8. Emissão de contrato gerando PDF. **`valor_extenso` vem da biblioteca `extenso`, nunca de digitação.**
9. Emissão em lote para N pessoas do mesmo objeto.
10. Máquina de estados da Seção 7, com `eventos_contrato` em transação e notificação após o commit.
11. Registro de envio com data, canal e destinatário, disparando `contrato_enviado`.
12. Registro de assinatura por upload do PDF assinado ou marcação de assinatura presencial.
13. Distrato gerando termo, sem apagar o contrato original.
14. Checklist de pendências por pessoa.

**Gate de saída**

- [ ] **`CONSULTAS.md` registra o Context 7 para Supabase Storage, Resend e React Email, e o front-end-design para as telas de pessoas, upload e link público de coleta.**
- [ ] Uma pessoa é cadastrada, recebe link por e-mail, envia documento e tem contrato emitido, enviado e assinado — sem sair da aplicação.
- [ ] Upload de imagem 72×72 px é **recusado** com mensagem compreensível. *(Este caso existiu 6 vezes no acervo real.)*
- [ ] Upload do mesmo arquivo duas vezes é recusado na segunda, apontando o existente.
- [ ] Contrato de R$ 3.553,00 gera exatamente `três mil, quinhentos e cinquenta e três reais`. Teste também 2.200,00; 4.353,00; 1.500,00.
- [ ] Transição inválida (ex.: `emitido` → `assinado`) é rejeitada com erro explicativo.
- [ ] Toda transição bem-sucedida gerou linha em `eventos_contrato`.
- [ ] **Disparar `contrato_enviado` duas vezes para o mesmo contrato envia um único e-mail.**
- [ ] **Simular queda do Resend: o contrato continua `enviado` e a notificação fica `falhou`.**
- [ ] Nenhum arquivo no Storage tem nome escolhido por humano.
- [ ] Nenhum bucket é público — teste acessando o objeto sem URL assinada e esperando negação.

---

### Fase 3 — Dashboard em tempo real

**Entregar**

1. Painel consolidado reproduzindo a matriz **categoria × status**: pessoas contratadas, contrato pronto, enviado, assinado, com totais.
2. Atualização ao vivo via **Supabase Realtime**, com as tabelas na publicação e RLS validado no canal. Degradação para polling se o socket cair. Propagação em até 3 s.
3. Detalhamento progressivo: todo número é clicável até a lista nominal e daí até o documento, em no máximo dois cliques.
4. Visão por região, com comparativo de cobertura documental.
5. Funil: cadastrado → apto → emitido → enviado → assinado.
6. Central de pendências ordenada por criticidade, incluindo **notificações que falharam**.
7. Exportação em PDF (layout institucional) e XLSX (base nominal).

**Gate de saída**

- [ ] **`CONSULTAS.md` registra o Context 7 para Supabase Realtime e o front-end-design para o painel do gestor, incluindo densidade, hierarquia dos números e o caminho de detalhamento.**
- [ ] Dashboard carrega em menos de 2 s com 500 pessoas e 2.000 contratos semeados.
- [ ] Teste e2e com duas sessões: alteração numa aparece na outra em menos de 3 s.
- [ ] **Um `coord_regiao` assinado no Realtime não recebe evento de outra região** — verifique no socket, não só na tela.
- [ ] Exportação em XLSX abre no Excel sem erro de fórmula e bate com a consulta ao banco.
- [ ] Números do dashboard conferem com `SELECT` direto no banco — compare os dois.

---

### Fase 4 — Campo e automações

**Entregar**

1. Registro de atividade em no máximo **3 toques** a partir da tela inicial.
2. PWA instalável com fila local (IndexedDB) e sincronização automática ao voltar o sinal, com indicador honesto do que ainda não subiu.
3. OCR sugerindo nome e CPF a partir de RG/CNH, **sempre com confirmação humana antes de gravar**.
4. **pg_cron + Edge Functions** para: `vigencia_a_vencer` (7 e 3 dias), `lembrete_assinatura` (3 dias em `enviado`), `resumo_diario` (dias úteis, 8h America/Sao_Paulo) e reprocessamento de notificações `falhou`.
5. Rotas de cron protegidas por `CRON_SECRET`.
6. Política de retenção com expurgo de documentos pessoais ao fim da campanha, registrando o expurgo.
7. Importação de planilha de cadastro e carga em lote, com conferência assistida que sinaliza duplicatas e documentos ilegíveis antes de gravar.

**Gate de saída**

- [ ] **`CONSULTAS.md` registra o Context 7 para `pg_cron`, Edge Functions e `tesseract.js`, e o front-end-design para o fluxo de campo em 360 px.**
- [ ] Registro de atividade em modo avião entra na fila e sobe sozinho ao restaurar a rede.
- [ ] Fluxo completo utilizável com uma só mão em viewport de 360 px.
- [ ] OCR nunca grava sem confirmação — teste prova isso.
- [ ] **Rodar o job de vigência duas vezes no mesmo dia envia um único e-mail por contrato.**
- [ ] **Rota de cron sem `CRON_SECRET` responde 401.**
- [ ] Fuso horário correto: o resumo das 8h de Brasília não sai às 5h nem às 11h.
- [ ] Importação de planilha com 2 CPFs repetidos sinaliza os 2 antes de gravar.

---

## 10. Requisitos não funcionais

| Item | Exigência |
|---|---|
| Tempo real | Propagação em até 3 s; degradação para polling |
| Desempenho | Dashboard < 2 s com 500 pessoas e 2.000 contratos |
| Mobile | Responsivo a partir de 360 px |
| Segurança | MFA TOTP para gestor e coord_comite; `service_role` fora do caminho da requisição |
| URLs de arquivo | Sempre assinadas, validade máxima de 15 minutos; nenhum bucket público |
| E-mail | Domínio verificado com SPF, DKIM e DMARC; idempotência por chave; sem dado sensível no corpo |
| LGPD | Base legal por finalidade, consentimento versionado no link público, direito de eliminação, trilha de acesso completa |
| Multi-tenant | Isolamento por RLS, válido também no Realtime e no Storage |
| Auditabilidade | Reconstruir o estado do sistema em qualquer data passada a partir de `eventos_contrato` |
| Acessibilidade | WCAG 2.1 AA nas telas de uso frequente |

---

## 11. Dados de exemplo para o seed

Use os números reais do acervo que originou o produto — servem de teste de aceitação do
dashboard porque o resultado correto já é conhecido.

**Organização:** `Comitê Michelle — Eleição 2026`
**Vigência de todos os contratos:** 01/09/2026 a 03/10/2026

| Objeto | Valor | Quantidade | Assinados |
|---|---|:--:|:--:|
| Administrativo e Montagem de Material | R$ 3.553,00 | 14 | 4 |
| Coordenador de Comitê da Campanha | R$ 4.353,00 | 2 | 0 |
| Administrativo Homeoffice | R$ 2.200,00 | 2 | 1 |
| Militância e Mobilização de Rua | R$ 1.500,00 | 3 | 2 |
| **Total do comitê** | | **21** | **7** |

Mais **6 contratos distratados** (todos com distrato assinado) que **não** entram no quadro ativo.

| Localidade | Prontos | Enviados | Assinados |
|---|:--:|:--:|:--:|
| Águas Claras | 8 | 8 | 5 |
| Paranoá | 4 | 3 | 3 |
| Gama | 10 | 10 | 2 |
| Recantos | 8 | 8 | 8 |
| Taguatinga | 12 | 12 | *não informado* |
| Planaltina | 10 | 10 | 0 |
| Sobradinho | 0 | 0 | 0 |
| São Sebastião | 0 | 0 | 0 |
| Samambaia | 0 | 0 | 0 |
| Riacho Fundo | 3 | 3 | 0 |
| **Total** | **55** | **54** | **18** |

> **Atenção ao semear.** Taguatinga tem assinados **não informado**, que é diferente de zero.
> Modele como `NULL` e garanta que o dashboard exiba "não informado" e não `0` — tratar
> ausência como zero infla artificialmente o desempenho, e isso é exatamente o tipo de erro
> que o produto existe para impedir.

Gere também **500 pessoas e 2.000 contratos fictícios** em `seed:carga` para o teste de
desempenho da Fase 3. **Todos os e-mails do seed devem usar um domínio de descarte** — jamais
endereço real, para não disparar e-mail de verdade a partir de dados de teste.

---

## 12. Testes obrigatórios

**Unidade**

- `podeTransicionar` cobrindo todas as transições válidas e pelo menos 5 inválidas.
- Valor por extenso para 3.553,00 / 4.353,00 / 2.200,00 / 1.500,00 / 1.000.000,00 / 0,01.
- Validação de CPF: válidos, inválidos, com e sem máscara, todos os dígitos iguais.
- Validação de dimensão: 799 px rejeita, 800 px aceita.
- Cálculo de hash e detecção de duplicata.
- Geração de `chave_idempotencia` — mesma entrada produz sempre a mesma chave.

**Integração**

- RLS com anon key + JWT real: organização A não lê nada de B.
- RLS: `coord_regiao` da região X não lê pessoa da região Y.
- Transição de contrato grava evento na mesma transação; rollback não deixa evento órfão.
- Envio duplicado é bloqueado pelo índice único de `chave_idempotencia`.
- Resend indisponível: operação de negócio conclui, notificação fica `falhou`.
- Webhook do Resend com assinatura inválida é rejeitado.

**E2E (Playwright)**

- Fluxo completo: cadastro → link por e-mail → documento → contrato emitido → enviado → assinado.
- Duas sessões abertas: alteração numa propaga para a outra em menos de 3 s.
- Upload de imagem pequena é recusado com mensagem legível.
- `coord_regiao` recebe 403 ao tentar abrir pessoa de outra região pela URL.
- Objeto do Storage não abre sem URL assinada.

---

## 13. Critérios de aceite do MVP

O MVP está pronto quando **todas** as afirmações forem verdadeiras em produção:

1. Um coordenador de região cadastra pessoa e coleta documentos pelo celular, sozinho.
2. Documento em resolução insuficiente é rejeitado no ato, com explicação compreensível.
3. Contrato é emitido por template, sem digitação de valores, e o texto por extenso sai correto.
4. O envio para assinatura fica registrado com data e canal, e o contratado é avisado por e-mail.
5. O gestor abre o dashboard e vê a matriz consolidada correta, sem preparação prévia.
6. Alteração de um coordenador aparece na tela do gestor em menos de 3 segundos.
7. O relatório em PDF é exportado em um clique.
8. Um distrato remove a pessoa do quadro ativo e a preserva na visão separada.
9. Todo acesso a documento pessoal aparece no log de auditoria exportável.
10. Um `coord_regiao` não consegue, por nenhum caminho, ver dados de outra região.
11. Nenhum e-mail duplicado é enviado, mesmo com job rodando duas vezes.
12. Nenhum e-mail contém CPF, RG, endereço, dado bancário ou valor de contrato.

**Teste definitivo:** reproduzir dentro da plataforma o mesmo relatório consolidado que hoje
exige abrir mais de 40 PDFs, e chegar ao mesmo número. Se divergir, ou a modelagem está errada,
ou a apuração manual estava — e nos dois casos é isso que o produto existe para eliminar.

---

## 14. Comece por aqui

**Antes de escrever qualquer código:**

1. Consulte o **Superpowers**, liste as skills aplicáveis à Fase 1 e diga qual fluxo vai seguir.
2. Consulte o **Context 7** para Supabase (Auth, RLS, Storage), Next.js 15 e Drizzle, nas versões que o `package.json` vai instalar.
3. Crie `CONSULTAS.md` com as duas consultas já registradas.

Só então execute a **Fase 1**. Ao terminar:

4. Rode o gate de saída e cole o resultado.
5. Escreva `PROGRESSO.md` com o que ficou pronto e o que ficou pendente.
6. Liste as decisões que você precisou tomar e que não estavam neste documento.
7. Aponte qualquer ponto em que o Context 7 divergiu do que você teria escrito de memória — é o sinal mais útil de que a consulta valeu.
8. **Pare e aguarde** antes de iniciar a Fase 2.
