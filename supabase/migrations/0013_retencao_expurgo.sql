-- Fase 4, item 6: política de retenção com expurgo de documentos pessoais ao fim
-- da campanha, registrando o expurgo.
--
-- `documentos.expurgado_em` marca o documento cujo objeto no Storage já foi
-- apagado. `expurgos` é o registro append-only do que foi expurgado, quando, por
-- quem e por quê — sobrevive mesmo se a linha de `documentos` for limpa depois.

ALTER TABLE public.documentos ADD COLUMN IF NOT EXISTS expurgado_em timestamptz;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS public.expurgos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES public.organizacoes(id),
  documento_id uuid NOT NULL REFERENCES public.documentos(id),
  pessoa_id uuid NOT NULL REFERENCES public.pessoas(id),
  tipo text NOT NULL,
  hash_sha256 text NOT NULL,
  motivo text NOT NULL,
  executado_por uuid REFERENCES public.usuarios(id),
  expurgado_em timestamptz NOT NULL DEFAULT now(),
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint

ALTER TABLE public.expurgos ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

CREATE POLICY expurgos_organizacao_select ON public.expurgos
  FOR SELECT TO authenticated
  USING (organizacao_id = (SELECT public.organizacao_id()));
--> statement-breakpoint

CREATE POLICY expurgos_organizacao_insert ON public.expurgos
  FOR INSERT TO authenticated
  WITH CHECK (organizacao_id = (SELECT public.organizacao_id()));
--> statement-breakpoint

-- MFA obrigatório para gestor/coord_comite (mesma restritiva das demais tabelas).
CREATE POLICY expurgos_mfa ON public.expurgos
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (
    (SELECT public.papel()) NOT IN ('gestor', 'coord_comite')
    OR ((SELECT auth.jwt()) ->> 'aal') = 'aal2'
  )
  WITH CHECK (
    (SELECT public.papel()) NOT IN ('gestor', 'coord_comite')
    OR ((SELECT auth.jwt()) ->> 'aal') = 'aal2'
  );
--> statement-breakpoint

-- Registra o expurgo e marca o documento na mesma transação (uma chamada de
-- função é atômica). SEM SECURITY DEFINER: quem chama é o gestor autenticado, a
-- RLS de documentos/expurgos continua valendo.
CREATE OR REPLACE FUNCTION public.registrar_expurgo_documento(
  p_documento_id uuid,
  p_motivo text
)
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_doc public.documentos%ROWTYPE;
BEGIN
  SELECT * INTO v_doc FROM public.documentos WHERE id = p_documento_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Documento não encontrado.';
  END IF;
  IF v_doc.expurgado_em IS NOT NULL THEN
    RETURN; -- já expurgado, idempotente
  END IF;

  INSERT INTO public.expurgos
    (organizacao_id, documento_id, pessoa_id, tipo, hash_sha256, motivo, executado_por)
  VALUES
    (v_doc.organizacao_id, v_doc.id, v_doc.pessoa_id, v_doc.tipo, v_doc.hash_sha256,
     p_motivo, (SELECT auth.uid()));

  UPDATE public.documentos SET expurgado_em = now() WHERE id = p_documento_id;
END;
$$;
--> statement-breakpoint

REVOKE ALL ON FUNCTION public.registrar_expurgo_documento(uuid, text) FROM PUBLIC, anon;
--> statement-breakpoint

GRANT EXECUTE ON FUNCTION public.registrar_expurgo_documento(uuid, text) TO authenticated;
