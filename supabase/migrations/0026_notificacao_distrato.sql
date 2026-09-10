-- Adiciona 'distrato_enviado' ao tipo enum tipo_notificacao
ALTER TYPE public.tipo_notificacao ADD VALUE IF NOT EXISTS 'distrato_enviado';
