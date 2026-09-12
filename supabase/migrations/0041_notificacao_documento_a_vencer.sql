-- Adiciona 'documento_a_vencer' ao tipo enum tipo_notificacao.
--
-- Par do `vigencia_a_vencer`: aquele avisa contrato chegando ao fim, este avisa
-- documento chegando ao vencimento. Ambos rodam no mesmo job diário.
ALTER TYPE public.tipo_notificacao ADD VALUE IF NOT EXISTS 'documento_a_vencer';
