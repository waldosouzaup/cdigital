-- Modelo de DISTRATO editável pelo administrador (/configuracoes?aba=modelos).
--
-- O termo de rescisão era texto fixo no código (`src/lib/contratos/distrato.ts`):
-- mudar cláusula, foro ou a qualificação da CONTRATANTE exigia deploy. Passa a
-- morar na mesma tabela dos modelos de minuta, separado por `tipo`.
--
-- `tipo` entra com default 'contrato' para que toda linha existente continue
-- sendo modelo de minuta e nada mude na emissão de contrato.

ALTER TABLE public.templates_contrato
  ADD COLUMN tipo text NOT NULL DEFAULT 'contrato';
--> statement-breakpoint

ALTER TABLE public.templates_contrato
  ADD CONSTRAINT templates_contrato_tipo_valido
  CHECK (tipo IN ('contrato', 'distrato'));
--> statement-breakpoint

-- A rescisão não escolhe modelo na hora de distratar: usa o modelo ativo do
-- comitê. O índice parcial garante que exista no máximo um por organização.
CREATE UNIQUE INDEX templates_contrato_distrato_unico
  ON public.templates_contrato (organizacao_id)
  WHERE tipo = 'distrato';
--> statement-breakpoint

COMMENT ON COLUMN public.templates_contrato.tipo IS
  'contrato = modelo de minuta usado na emissão; distrato = termo de rescisão, no máximo um por organização.';
