-- Fase 4, item 4: pg_cron + pg_net disparando as 4 rotas de automação.
--
-- Decisão de arquitetura (registrada em CONSULTAS.md e PROGRESSO-FASE-2-3-4.md):
-- o PROMPT §3 fala em "pg_cron chamando Edge Function", mas o deploy de Edge
-- Function está bloqueado nesta sessão (sem SUPABASE_ACCESS_TOKEN, CLI trava) e
-- tanto o gate ("rota de cron sem CRON_SECRET responde 401") quanto a §4
-- ("api/cron/ — rotas protegidas por CRON_SECRET") apontam para rotas Next.js.
-- Então: pg_cron -> net.http_post -> /api/cron/* (guardadas por CRON_SECRET,
-- usando a service_role, uso que a §3.1 permite explicitamente para "jobs do
-- pg_cron e webhooks").
--
-- As expressões de agendamento abaixo são cópia fiel das constantes de
-- src/lib/cron/agenda.ts — um teste (tests/unit/cron/agenda.test.ts) lê este
-- arquivo e recusa qualquer divergência.

CREATE EXTENSION IF NOT EXISTS pg_net;
--> statement-breakpoint

CREATE EXTENSION IF NOT EXISTS pg_cron;
--> statement-breakpoint

-- Segredos lidos pelos jobs. Valores reais são definidos pelo operador APÓS o
-- deploy (a aplicação ainda não tem URL pública):
--   select vault.update_secret(
--     (select id from vault.secrets where name = 'comite_app_url'),
--     'https://comite-digital.netlify.app');
--   select vault.update_secret(
--     (select id from vault.secrets where name = 'comite_cron_secret'),
--     '<valor de CRON_SECRET no ambiente da aplicação>');
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'comite_app_url') THEN
    PERFORM vault.create_secret(
      'http://localhost:3000',
      'comite_app_url',
      'URL base da aplicação Comitê Digital para os jobs de pg_cron (Fase 4).'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'comite_cron_secret') THEN
    PERFORM vault.create_secret(
      'DEFINIR_NO_DEPLOY',
      'comite_cron_secret',
      'CRON_SECRET enviada no header Authorization: Bearer das rotas /api/cron/* (Fase 4).'
    );
  END IF;
END $$;
--> statement-breakpoint

-- Helper: monta e dispara o POST para uma rota de cron, com o Bearer da CRON_SECRET.
-- Concentra a leitura do Vault num lugar só — cada cron.schedule abaixo é uma linha.
CREATE OR REPLACE FUNCTION public.disparar_rota_cron(p_caminho text)
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'comite_app_url')
           || p_caminho,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' ||
        (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'comite_cron_secret')
    ),
    body := jsonb_build_object('disparado_em', now()),
    timeout_milliseconds := 30000
  );
$$;
--> statement-breakpoint

REVOKE ALL ON FUNCTION public.disparar_rota_cron(text) FROM PUBLIC, anon, authenticated;
--> statement-breakpoint

-- cron.schedule faz upsert pelo nome do job — reaplicar esta migration é seguro.

-- vigencia_a_vencer (7 e 3 dias): CRON_VIGENCIA_A_VENCER = "0 10 * * *"
SELECT cron.schedule(
  'comite_vigencia_a_vencer',
  '0 10 * * *',
  $$SELECT public.disparar_rota_cron('/api/cron/vigencia')$$
);
--> statement-breakpoint

-- lembrete_assinatura (3 dias em enviado): CRON_LEMBRETE_ASSINATURA = "15 10 * * *"
SELECT cron.schedule(
  'comite_lembrete_assinatura',
  '15 10 * * *',
  $$SELECT public.disparar_rota_cron('/api/cron/lembrete-assinatura')$$
);
--> statement-breakpoint

-- resumo_diario (dias úteis, 8h America/Sao_Paulo): CRON_RESUMO_DIARIO = "0 11 * * 1-5"
SELECT cron.schedule(
  'comite_resumo_diario',
  '0 11 * * 1-5',
  $$SELECT public.disparar_rota_cron('/api/cron/resumo-diario')$$
);
--> statement-breakpoint

-- reprocessamento de notificações falhou: CRON_REPROCESSAR_NOTIFICACOES = "*/15 * * * *"
SELECT cron.schedule(
  'comite_reprocessar_notificacoes',
  '*/15 * * * *',
  $$SELECT public.disparar_rota_cron('/api/cron/reprocessar-notificacoes')$$
);
