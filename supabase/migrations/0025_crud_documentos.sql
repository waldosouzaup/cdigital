-- Migration 0025: CRUD Completo de Documentos
-- Permite exclusão de documentos com arquivamento em DadosExcluidos
-- e adiciona política de DELETE no bucket documentos para gestor/coord_comite/superadmin.

DROP POLICY IF EXISTS "Exclusao por organizacao — documentos" ON storage.objects;
--> statement-breakpoint

CREATE POLICY "Exclusao por organizacao — documentos"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'documentos'
    AND (
      ((storage.foldername(name))[1] = (SELECT public.organizacao_id())::text
       AND (SELECT public.papel()) IN ('gestor', 'coord_comite'))
      OR (SELECT public.papel()) = 'superadmin'
    )
  );
--> statement-breakpoint

-- Função atômica que captura snapshot de documento e pessoa vinculada,
-- grava em dados_excluidos com nome e login do executor, registra auditoria
-- e remove o registro de public.documentos.
CREATE OR REPLACE FUNCTION public.excluir_documento(
  p_documento_id uuid,
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
  v_doc public.documentos%ROWTYPE;
  v_pessoa public.pessoas%ROWTYPE;
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

  IF v_user_papel NOT IN ('gestor', 'coord_comite', 'superadmin') THEN
    RAISE EXCEPTION 'Apenas gestores, coordenadores ou superadmins podem excluir documentos.';
  END IF;

  IF v_user_papel = 'superadmin' AND v_user_org_id IS NULL THEN
    SELECT * INTO v_doc
    FROM public.documentos
    WHERE id = p_documento_id
    FOR UPDATE;
  ELSE
    SELECT * INTO v_doc
    FROM public.documentos
    WHERE id = p_documento_id AND organizacao_id = v_user_org_id
    FOR UPDATE;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Documento não encontrado ou já excluído.';
  END IF;

  SELECT * INTO v_pessoa
  FROM public.pessoas
  WHERE id = v_doc.pessoa_id;

  v_dados := jsonb_build_object(
    'documento', row_to_json(v_doc),
    'pessoa', row_to_json(v_pessoa),
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
    v_doc.organizacao_id,
    'documento',
    p_documento_id,
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
    v_doc.organizacao_id,
    v_auth_uid,
    'exclusao_documento',
    'documentos',
    p_documento_id
  );

  DELETE FROM public.documentos WHERE id = p_documento_id;

  RETURN jsonb_build_object(
    'ok', true,
    'id', v_excluido_id,
    'documento_id', p_documento_id,
    'pessoa_id', v_doc.pessoa_id,
    'caminho_storage', v_doc.caminho_storage,
    'pessoa_nome', v_pessoa.nome_completo
  );
END;
$$;
--> statement-breakpoint

REVOKE ALL ON FUNCTION public.excluir_documento(uuid, text) FROM PUBLIC, anon;
--> statement-breakpoint

GRANT EXECUTE ON FUNCTION public.excluir_documento(uuid, text) TO authenticated;
