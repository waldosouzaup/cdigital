-- Migration 0021: Tabela DadosExcluidos e função de exclusão de contratos
-- Arquiva os dados do contratado e remove o registro do painel, registrando
-- nome e login de quem efetuou a exclusão.

CREATE TABLE IF NOT EXISTS public.dados_excluidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES public.organizacoes(id),
  tipo_registro text NOT NULL DEFAULT 'contrato',
  registro_id uuid,
  dados jsonb NOT NULL,
  usuario_id uuid REFERENCES public.usuarios(id),
  usuario_nome text NOT NULL,
  usuario_login text NOT NULL,
  motivo text,
  excluido_em timestamptz NOT NULL DEFAULT now(),
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS dados_excluidos_organizacao_id_excluido_em_idx
  ON public.dados_excluidos(organizacao_id, excluido_em DESC);
--> statement-breakpoint

CREATE OR REPLACE VIEW public."DadosExcluidos" AS
  SELECT * FROM public.dados_excluidos;
--> statement-breakpoint

ALTER TABLE public.dados_excluidos ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

CREATE POLICY dados_excluidos_select ON public.dados_excluidos
  FOR SELECT TO authenticated
  USING (organizacao_id = (SELECT public.organizacao_id()));
--> statement-breakpoint

CREATE POLICY dados_excluidos_insert ON public.dados_excluidos
  FOR INSERT TO authenticated
  WITH CHECK (organizacao_id = (SELECT public.organizacao_id()));
--> statement-breakpoint

CREATE POLICY dados_excluidos_mfa ON public.dados_excluidos
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

GRANT SELECT, INSERT ON public.dados_excluidos TO authenticated;
--> statement-breakpoint

GRANT SELECT ON public."DadosExcluidos" TO authenticated;
--> statement-breakpoint

-- Função atômica que captura snapshot de contrato, pessoa e eventos,
-- grava em dados_excluidos com nome e login do executor, registra auditoria
-- e remove o contrato do painel.
CREATE OR REPLACE FUNCTION public.excluir_contrato(
  p_contrato_id uuid,
  p_motivo text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_auth_uid uuid;
  v_user_papel text;
  v_user_org_id uuid;
  v_user_nome text;
  v_user_email text;
  v_contrato public.contratos%ROWTYPE;
  v_pessoa public.pessoas%ROWTYPE;
  v_eventos jsonb;
  v_dados jsonb;
  v_excluido_id uuid;
BEGIN
  v_auth_uid := (SELECT auth.uid());
  IF v_auth_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;

  SELECT papel::text, organizacao_id, nome, email
  INTO v_user_papel, v_user_org_id, v_user_nome, v_user_email
  FROM public.usuarios
  WHERE id = v_auth_uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuário não encontrado no sistema.';
  END IF;

  IF v_user_papel NOT IN ('gestor', 'coord_comite') THEN
    RAISE EXCEPTION 'Apenas gestores ou coordenadores de comitê podem excluir contratos.';
  END IF;

  SELECT * INTO v_contrato
  FROM public.contratos
  WHERE id = p_contrato_id AND organizacao_id = v_user_org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contrato não encontrado ou já excluído.';
  END IF;

  SELECT * INTO v_pessoa
  FROM public.pessoas
  WHERE id = v_contrato.pessoa_id;

  SELECT coalesce(jsonb_agg(row_to_json(e)), '[]'::jsonb)
  INTO v_eventos
  FROM public.eventos_contrato e
  WHERE e.contrato_id = p_contrato_id;

  v_dados := jsonb_build_object(
    'contrato', row_to_json(v_contrato),
    'pessoa', row_to_json(v_pessoa),
    'eventos', v_eventos,
    'excluido_por', jsonb_build_object(
      'id', v_auth_uid,
      'nome', v_user_nome,
      'login', v_user_email,
      'papel', v_user_papel
    ),
    'motivo', p_motivo
  );

  INSERT INTO public.dados_excluidos (
    organizacao_id,
    tipo_registro,
    registro_id,
    dados,
    usuario_id,
    usuario_nome,
    usuario_login,
    motivo,
    excluido_em
  ) VALUES (
    v_user_org_id,
    'contrato',
    p_contrato_id,
    v_dados,
    v_auth_uid,
    v_user_nome,
    v_user_email,
    p_motivo,
    now()
  )
  RETURNING id INTO v_excluido_id;

  INSERT INTO public.log_auditoria (
    organizacao_id,
    usuario_id,
    acao,
    entidade,
    entidade_id
  ) VALUES (
    v_user_org_id,
    v_auth_uid,
    'exclusao_contrato',
    'contratos',
    p_contrato_id
  );

  DELETE FROM public.eventos_contrato WHERE contrato_id = p_contrato_id;
  DELETE FROM public.contratos WHERE id = p_contrato_id;

  RETURN jsonb_build_object(
    'ok', true,
    'id', v_excluido_id,
    'contrato_id', p_contrato_id,
    'pessoa_nome', v_pessoa.nome_completo
  );
END;
$$;
--> statement-breakpoint

REVOKE ALL ON FUNCTION public.excluir_contrato(uuid, text) FROM PUBLIC, anon;
--> statement-breakpoint

GRANT EXECUTE ON FUNCTION public.excluir_contrato(uuid, text) TO authenticated;
