-- Migração 0032: Coleta de Dados de Contato e Pagamento (Banco, Agência e Conta)
--
-- Permite coletar e persistir diretamente no formulário de coleta pública (/coleta/[token])
-- as informações bancárias e de contato completas exigidas na formalização do contrato.

CREATE OR REPLACE FUNCTION public.enviar_dados_coleta(
  p_token text,
  p_telefone text,
  p_endereco text,
  p_cep text,
  p_rg text,
  p_data_nascimento date,
  p_chave_pix text,
  p_email text,
  p_ip text DEFAULT NULL,
  p_geolocalizacao jsonb DEFAULT NULL,
  p_user_agent text DEFAULT NULL,
  p_banco text DEFAULT NULL,
  p_agencia text DEFAULT NULL,
  p_conta text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_link_id uuid;
  v_pessoa_id uuid;
  v_org_id uuid;
BEGIN
  SELECT l.id, l.pessoa_id, l.organizacao_id
  INTO v_link_id, v_pessoa_id, v_org_id
  FROM public.links_coleta l
  WHERE l.token = p_token
    AND l.usado_em IS NULL
    AND l.expira_em > now()
  FOR UPDATE;

  IF v_pessoa_id IS NULL THEN
    RETURN false;
  END IF;

  UPDATE public.pessoas SET
    telefone = COALESCE(NULLIF(p_telefone, ''), telefone),
    endereco = COALESCE(NULLIF(p_endereco, ''), endereco),
    cep = COALESCE(NULLIF(p_cep, ''), cep),
    rg = COALESCE(NULLIF(p_rg, ''), rg),
    data_nascimento = COALESCE(p_data_nascimento, data_nascimento),
    chave_pix = COALESCE(NULLIF(p_chave_pix, ''), chave_pix),
    banco = COALESCE(NULLIF(p_banco, ''), banco),
    agencia = COALESCE(NULLIF(p_agencia, ''), agencia),
    conta = COALESCE(NULLIF(p_conta, ''), conta),
    email = COALESCE(NULLIF(p_email, ''), email)
  WHERE id = v_pessoa_id;

  UPDATE public.links_coleta SET
    usado_em = now(),
    ip_origem = COALESCE(NULLIF(p_ip, ''), ip_origem),
    geolocalizacao = COALESCE(p_geolocalizacao, geolocalizacao),
    user_agent = COALESCE(NULLIF(p_user_agent, ''), user_agent)
  WHERE id = v_link_id;

  -- Grava o evento de auditoria de conclusão da coleta
  INSERT INTO public.log_auditoria (
    organizacao_id,
    usuario_id,
    acao,
    entidade,
    entidade_id,
    ip,
    detalhes,
    ocorrido_em
  ) VALUES (
    v_org_id,
    NULL,
    'conclusao_coleta',
    'links_coleta',
    v_link_id,
    NULLIF(p_ip, ''),
    jsonb_build_object(
      'token', p_token,
      'pessoa_id', v_pessoa_id,
      'geolocalizacao', p_geolocalizacao,
      'user_agent', p_user_agent,
      'campos_preenchidos', jsonb_build_object(
        'telefone', p_telefone IS NOT NULL AND p_telefone <> '',
        'endereco', p_endereco IS NOT NULL AND p_endereco <> '',
        'cep', p_cep IS NOT NULL AND p_cep <> '',
        'rg', p_rg IS NOT NULL AND p_rg <> '',
        'data_nascimento', p_data_nascimento IS NOT NULL,
        'chave_pix', p_chave_pix IS NOT NULL AND p_chave_pix <> '',
        'banco', p_banco IS NOT NULL AND p_banco <> '',
        'agencia', p_agencia IS NOT NULL AND p_agencia <> '',
        'conta', p_conta IS NOT NULL AND p_conta <> '',
        'email', p_email IS NOT NULL AND p_email <> ''
      )
    ),
    now()
  );

  RETURN true;
END;
$$;
--> statement-breakpoint

REVOKE ALL ON FUNCTION public.enviar_dados_coleta(text, text, text, text, text, date, text, text, text, jsonb, text, text, text, text) FROM PUBLIC;
--> statement-breakpoint

GRANT EXECUTE ON FUNCTION public.enviar_dados_coleta(text, text, text, text, text, date, text, text, text, jsonb, text, text, text, text) TO anon, authenticated;
