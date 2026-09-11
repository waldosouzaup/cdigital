-- Migration 0029: Remove política restritiva MFA de dados_excluidos e adiciona função atômica excluir_pessoa
-- Alinha dados_excluidos com a migração 0018_mfa_opcional (TOTP opcional sem travar RLS do gestor).
-- Adiciona a RPC atômica pública excluir_pessoa (SECURITY DEFINER) para exclusão segura com auditoria.

-- 1. Remove a política restritiva que bloqueava o gestor logado sem MFA AAL2
DROP POLICY IF EXISTS "dados_excluidos_mfa" ON public.dados_excluidos;
--> statement-breakpoint

-- 2. Cria a função atômica excluir_pessoa (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.excluir_pessoa(
  p_pessoa_id uuid,
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
  v_pessoa public.pessoas%ROWTYPE;
  v_contratos_ativos_count integer;
  v_documentos jsonb;
  v_contratos jsonb;
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
    RAISE EXCEPTION 'Apenas gestores ou administradores podem excluir colaboradores.';
  END IF;

  SELECT * INTO v_pessoa
  FROM public.pessoas
  WHERE id = p_pessoa_id AND organizacao_id = v_user_org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Colaborador não encontrado ou já excluído.';
  END IF;

  -- Trava de integridade: checa se há contratos ativos ou emitidos
  SELECT count(*) INTO v_contratos_ativos_count
  FROM public.contratos
  WHERE pessoa_id = p_pessoa_id AND status NOT IN ('cancelado', 'distrato_assinado');

  IF v_contratos_ativos_count > 0 THEN
    RAISE EXCEPTION 'Não é possível excluir este colaborador pois ele possui contrato(s) ativo(s) ou em andamento. Cancele ou distrate os contratos vinculados antes de excluir.';
  END IF;

  -- Coleta snapshots de documentos e contratos para arquivamento
  SELECT coalesce(jsonb_agg(row_to_json(d)), '[]'::jsonb)
  INTO v_documentos
  FROM public.documentos d
  WHERE d.pessoa_id = p_pessoa_id;

  SELECT coalesce(jsonb_agg(row_to_json(c)), '[]'::jsonb)
  INTO v_contratos
  FROM public.contratos c
  WHERE c.pessoa_id = p_pessoa_id;

  v_dados := jsonb_build_object(
    'pessoa', row_to_json(v_pessoa),
    'documentos', v_documentos,
    'contratos', v_contratos,
    'excluido_por', jsonb_build_object(
      'id', v_auth_uid,
      'nome', v_user_nome,
      'login', v_user_email,
      'papel', v_user_papel
    ),
    'motivo', p_motivo
  );

  -- Grava snapshot completo em dados_excluidos
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
    'pessoa',
    p_pessoa_id,
    v_dados,
    v_auth_uid,
    v_user_nome,
    v_user_email,
    p_motivo,
    now()
  )
  RETURNING id INTO v_excluido_id;

  -- Registra no log de auditoria
  INSERT INTO public.log_auditoria (
    organizacao_id,
    usuario_id,
    acao,
    entidade,
    entidade_id
  ) VALUES (
    v_user_org_id,
    v_auth_uid,
    'exclusao',
    'pessoas',
    p_pessoa_id
  );

  -- Remove dependências auxiliares e o registro da pessoa
  DELETE FROM public.links_coleta WHERE pessoa_id = p_pessoa_id;
  DELETE FROM public.documentos WHERE pessoa_id = p_pessoa_id;
  DELETE FROM public.registros_atividade WHERE pessoa_id = p_pessoa_id;
  DELETE FROM public.pessoas WHERE id = p_pessoa_id;

  RETURN jsonb_build_object(
    'ok', true,
    'id', v_excluido_id,
    'pessoa_id', p_pessoa_id,
    'pessoa_nome', v_pessoa.nome_completo
  );
END;
$$;
--> statement-breakpoint

REVOKE ALL ON FUNCTION public.excluir_pessoa(uuid, text) FROM PUBLIC, anon;
--> statement-breakpoint

GRANT EXECUTE ON FUNCTION public.excluir_pessoa(uuid, text) TO authenticated;
