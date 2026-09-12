-- Data de validade do documento.
--
-- `documentos.tipo` é texto livre e a triagem é pendente/aprovado/rejeitado —
-- suficiente para RG e comprovante de residência, que não vencem. Não serve para
-- documento com prazo: NR, ASO, treinamento, credencial de evento, CNH. Hoje um
-- treinamento vencido segue marcado como aprovado para sempre, e a conferência
-- não tem como saber.
--
-- Nulável de propósito: a maioria dos documentos não vence, e exigir data faria
-- a triagem de identidade pedir um campo que não existe.

ALTER TABLE public.documentos
  ADD COLUMN IF NOT EXISTS valido_ate date;
--> statement-breakpoint

-- O job diário varre por data de validade dentro de uma janela curta; sem índice
-- isso vira varredura completa da tabela todo dia.
CREATE INDEX IF NOT EXISTS documentos_valido_ate_idx
  ON public.documentos (valido_ate)
  WHERE valido_ate IS NOT NULL AND status = 'aprovado';
--> statement-breakpoint

COMMENT ON COLUMN public.documentos.valido_ate IS
  'Vencimento do documento. Nulo = não vence. Documento aprovado e vencido deixa de valer como comprovação.';
--> statement-breakpoint

NOTIFY pgrst, 'reload schema';
