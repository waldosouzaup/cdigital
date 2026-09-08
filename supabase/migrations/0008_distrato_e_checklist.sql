-- Fase 2, item 13: distrato gerando termo (documento), sem apagar o contrato
-- original — o termo é só mais um PDF anexado ao mesmo registro de contrato,
-- igual ao PDF de emissão e ao PDF assinado.
ALTER TABLE public.contratos ADD COLUMN IF NOT EXISTS caminho_termo_distrato text;
