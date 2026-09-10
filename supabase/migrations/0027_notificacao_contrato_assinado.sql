-- Adiciona 'contrato_assinado' ao tipo enum tipo_notificacao
ALTER TYPE public.tipo_notificacao ADD VALUE IF NOT EXISTS 'contrato_assinado';
