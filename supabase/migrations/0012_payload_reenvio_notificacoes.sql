-- Fase 4, item 4: o job de reprocessamento de notificações `falhou` reenvia sem
-- re-renderizar o template por tipo. Para isso `sendNotification` passa a
-- persistir o payload já renderizado (assunto + HTML + texto) na própria linha.
-- Os templates da Seção 6 não carregam PII (regra 7), então é seguro guardar aqui.
ALTER TABLE public.notificacoes ADD COLUMN IF NOT EXISTS payload_reenvio jsonb;
