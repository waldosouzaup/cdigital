-- Adiciona 'convite_usuario' ao tipo enum tipo_notificacao
ALTER TYPE public.tipo_notificacao ADD VALUE IF NOT EXISTS 'convite_usuario';
