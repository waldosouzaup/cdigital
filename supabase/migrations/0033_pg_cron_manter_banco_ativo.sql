-- Job `manter_banco_ativo`: evitar que o Supabase pause o projeto por
-- inatividade (plano free pausa após ~7 dias sem "atividade").
--
-- Achado (registrado em CONSULTAS.md): jobs do `pg_cron` rodando sozinhos,
-- de dentro do Postgres, não contam como atividade para essa checagem — a
-- doc oficial e relatos da comunidade concordam que só uma chamada chegando
-- de FORA do banco (API/REST) conta. Por isso este job usa exatamente o
-- mesmo caminho dos outros 4 (`pg_cron` -> `pg_net` -> `/api/cron/*`), que já
-- é uma chamada externa de verdade: é ela, e não o `pg_cron` em si, que
-- resolve o problema.
--
-- Reaproveita tudo que a migration 0011 já criou (extensões pg_cron/pg_net,
-- os segredos do Vault, a função `public.disparar_rota_cron`) — só agenda
-- uma rota nova. Expressão idêntica a `CRON_MANTER_BANCO_ATIVO` em
-- `src/lib/cron/agenda.ts`; um teste (`tests/unit/cron/agenda.test.ts`) lê
-- este arquivo e recusa qualquer divergência.

-- cron.schedule faz upsert pelo nome do job — reaplicar esta migration é seguro.

-- manter_banco_ativo (04h America/Sao_Paulo, todos os dias, antes de todo o
-- resto): CRON_MANTER_BANCO_ATIVO = "0 7 * * *"
SELECT cron.schedule(
  'comite_manter_banco_ativo',
  '0 7 * * *',
  $$SELECT public.disparar_rota_cron('/api/cron/manter-banco-ativo')$$
);
