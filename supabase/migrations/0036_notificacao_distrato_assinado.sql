-- Adiciona 'distrato_assinado' ao tipo enum tipo_notificacao.
--
-- Fecha o par do fluxo de rescisão: `distrato_enviado` pede a assinatura,
-- `distrato_assinado` confirma e entrega o link da via assinada.
ALTER TYPE public.tipo_notificacao ADD VALUE IF NOT EXISTS 'distrato_assinado';
