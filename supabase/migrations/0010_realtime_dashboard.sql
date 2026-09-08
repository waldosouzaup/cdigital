-- Fase 3, item 2: o dashboard também precisa reagir em tempo real a aprovação de
-- documento (central de pendências) e a notificações que falharam — não só a
-- pessoas/contratos, que já estavam na publicação desde a Fase 1
-- (0003_triggers_realtime.sql).
DO $$
DECLARE
  tabela text;
BEGIN
  FOREACH tabela IN ARRAY ARRAY['documentos', 'notificacoes']
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = tabela
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tabela);
    END IF;
  END LOOP;
END $$;
