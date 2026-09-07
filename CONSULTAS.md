# Registro de consultas às skills obrigatórias

Exigido pela Seção 2.1 do `PROMPT-Comite-Digital.md`. Toda consulta a Superpowers,
Context 7 ou front-end-design gera uma linha aqui. A coluna **"o que mudou"** é a que
importa: um registro em que nada nunca muda reprova o gate.

## Como as skills estão instaladas neste ambiente

As três skills existem no disco, mas **nenhuma está registrada no `Skill` tool desta
sessão** — o comando `/plugin` não está disponível neste ambiente. Foram consultadas por
leitura direta dos arquivos e, no caso do Context 7, pela API REST:

| Skill | Caminho | Como é consultada |
|---|---|---|
| Superpowers 6.3.0 | `~/.claude/plugins/cache/superpowers-dev/superpowers/6.3.0/skills/` | leitura dos `SKILL.md` |
| Context 7 | `.agents/skills/context7/scripts/context7.sh` | `bash .agents/skills/context7/scripts/context7.sh search\|docs` |
| front-end-design | `~/.claude/plugins/marketplaces/anthropic-agent-skills/skills/frontend-design/SKILL.md` | leitura do `SKILL.md` |

Skills disponíveis no Superpowers 6.3.0: `brainstorming`, `dispatching-parallel-agents`,
`executing-plans`, `finishing-a-development-branch`, `receiving-code-review`,
`requesting-code-review`, `subagent-driven-development`, `systematic-debugging`,
`test-driven-development`, `using-git-worktrees`, `using-superpowers`,
`verification-before-completion`, `writing-plans`, `writing-skills`.

---

## Consultas

| Data | Fase | Skill | O que perguntei | O que mudou por causa da resposta |
|------|------|-------|-----------------|-----------------------------------|
| 2026-09-07 | 1 | Superpowers | Quais skills se aplicam ao início da Fase 1 e qual fluxo seguir | `brainstorming` classifica projeto novo como **Architectural** ("bounded mede o repositório, não sua familiaridade"), com HARD-GATE de aprovação humana antes de qualquer implementação. Parei antes de codar e escrevi um plano para aprovação em vez de scaffoldar direto. Fluxo adotado: brainstorming → writing-plans → test-driven-development → verification-before-completion |
| 2026-09-07 | 1 | Superpowers | Disciplina de teste exigida por tarefa | Lei de Ferro do `test-driven-development`: nenhum código de produção sem teste falhando antes, e código escrito antes do teste deve ser **apagado**, não adaptado. Reordenei as tarefas para que a máquina de estados (função pura, testável sem banco) venha antes de qualquer infraestrutura |
| 2026-09-07 | 1 | Superpowers | Como declarar uma fase concluída | `verification-before-completion` proíbe afirmar "passa" sem a saída do comando na mesma mensagem. O gate da Fase 1 será colado como saída bruta, não resumido |
| 2026-09-07 | 1 | Context 7 | API atual do Custom Access Token Hook do Supabase Auth | **Divergiu do que eu escreveria de memória.** O hook é uma **função Postgres**, não uma Edge Function: `public.custom_access_token_hook(event jsonb) returns jsonb`, `security definer`, `set search_path = ''`, registrada pela URI `pg-functions://postgres/public/custom_access_token_hook`. A linha de exemplo do próprio PROMPT (§2.1) sugere o contrário e teria me levado ao erro |
| 2026-09-07 | 1 | Context 7 | Permissões necessárias para o hook funcionar | Descoberto o bloco que eu teria omitido: `grant usage on schema public to supabase_auth_admin`, `grant execute on function ... to supabase_auth_admin`, `revoke execute ... from authenticated, anon, public`, `grant all on table public.usuarios to supabase_auth_admin`, mais uma policy `for select to supabase_auth_admin using (true)` em `usuarios`. Sem isso o hook falha **em silêncio** e o JWT sai sem `organizacao_id` |
| 2026-09-07 | 1 | Context 7 | Como tornar o MFA TOTP obrigatório para `gestor` e `coord_comite` | **Divergiu.** O enforcement correto é uma policy RLS `as restrictive` sobre `(select auth.jwt()->>'aal') = 'aal2'`, no banco — não uma checagem na aplicação. Eu teria implementado um guard no middleware, que é contornável por chamada direta à API. A obrigatoriedade virou policy condicional ao papel |
| 2026-09-07 | 1 | Context 7 | API de cookies do `@supabase/ssr` em Next.js 15 | **Divergiu.** `get`/`set`/`remove` estão depreciados; a API atual é `getAll`/`setAll`, e `setAll(cookiesToSet, headers)` recebe um **segundo argumento `headers`** que eu desconhecia. O refresh de sessão no middleware usa `supabase.auth.getClaims()`, não `getUser()` |
| 2026-09-07 | 1 | Context 7 | Como declarar RLS no Drizzle ORM | Drizzle tem suporte nativo: `pgPolicy` + roles pré-definidas de `drizzle-orm/supabase` (`anonRole`, `authenticatedRole`, `serviceRole`, `supabaseAuthAdminRole`) + `.enableRLS()`. O callback de config extra da tabela retorna **array**, não objeto. Mudou a arquitetura: as policies vão para `src/db/schema.ts` e são geradas nas migrations, em vez de SQL escrito à mão e fora de sincronia com o schema |
| 2026-09-07 | 1 | Context 7 | Policies de Storage e buckets privados | Confirmou a abordagem da §3.1: `(storage.foldername(name))[1]` extrai o primeiro segmento do caminho, que será o `organizacao_id`. Novidade útil: buckets são declaráveis em `config.toml` como `[storage.buckets.documentos] public = false`, em vez de criados por script |
| 2026-09-07 | 1 | Context 7 | Mudanças do App Router no Next.js 15 | `cookies()` é assíncrono e `params` é `Promise<{...}>` **tanto em página quanto em Route Handler** — eu teria escrito a forma síncrona. Afeta `/coleta/[token]` e todos os factories de cliente Supabase no servidor |
| 2026-09-07 | 1 | Context 7 | Situação das chaves `anon` e `service_role` | **Conflito com a §3.2 do PROMPT.** As chaves legadas estão depreciadas em favor de `publishable`/`secret` e serão removidas no fim de 2026. Conforme a §2.1 ("se conflitar com uma regra deste arquivo, pare e pergunte"), escalei ao usuário. Decisão: manter os nomes de variável da §3.2 e aceitar os dois formatos de chave |
| 2026-09-07 | 1 | front-end-design | Quais telas da Fase 1 exigem trabalho visual e que direção seguir | As telas de auth (login, verificação, MFA) **são** trabalho visual e não podem ser improvisadas por serem "só um formulário". A skill exige processo de duas passadas: plano de tokens (4–6 hex nomeados, tipografia, layout, princípios) revisado contra os defaults conhecidos, e só então código. Lista de defaults a evitar registrada para a Tarefa 8: fundo creme #F4F1EA com serifada de alto contraste e acento terracota #D97757, eyebrow em caixa alta acima de cada título, cards idênticos com um só border-radius e sombra cinza, `→` colado no texto de botão, meta unida por `·` |

---

## Lacunas do Context 7

Nenhuma até aqui. Todas as consultas da Fase 1 retornaram documentação da fonte oficial
(repositórios `supabase/supabase`, `supabase/cli`, `supabase/ssr`, `vercel/next.js`,
`drizzle-team/drizzle-orm-docs`).

Quando o Context 7 não cobrir um caso, a regra da §2.1 é registrar a lacuna aqui
explicitamente e ir à documentação oficial — nunca preencher de memória.
