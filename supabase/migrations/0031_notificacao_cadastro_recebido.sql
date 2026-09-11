-- Adiciona 'cadastro_recebido' ao tipo enum tipo_notificacao
ALTER TYPE public.tipo_notificacao ADD VALUE IF NOT EXISTS 'cadastro_recebido';
