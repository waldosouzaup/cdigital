-- Migração 0030: Auditoria Completa na Coleta de Dados (IP, Geolocalização, Horário e Metadados)
--
-- Garante rastreabilidade, integridade e conformidade jurídica (LGPD e normas eleitorais TSE)
-- no momento em que o usuário começa a preencher o formulário (/coleta/[token] e /inscricao/[slug])
-- e na submissão final dos dados.

-- 1. Novas colunas na tabela log_auditoria para armazenar detalhes técnicos estruturados (JSONB)
ALTER TABLE public.log_auditoria ADD COLUMN IF NOT EXISTS detalhes jsonb;
--> statement-breakpoint

-- 2. Novas colunas na tabela links_coleta para registro direto do ciclo de vida da coleta
ALTER TABLE public.links_coleta ADD COLUMN IF NOT EXISTS iniciado_em timestamptz;
ALTER TABLE public.links_coleta ADD COLUMN IF NOT EXISTS ip_origem text;
ALTER TABLE public.links_coleta ADD COLUMN IF NOT EXISTS geolocalizacao jsonb;
ALTER TABLE public.links_coleta ADD COLUMN IF NOT EXISTS user_agent text;
--> statement-breakpoint

-- 3. Função SECURITY DEFINER para registrar eventos de auditoria da coleta pública (/coleta/[token])
CREATE OR REPLACE FUNCTION public.registrar_auditoria_coleta(
  p_token text,
  p_acao text,
  p_ip text DEFAULT NULL,
  p_geolocalizacao jsonb DEFAULT NULL,
  p_user_agent text DEFAULT NULL,
  p_detalhes jsonb DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_link public.links_coleta%ROWTYPE;
BEGIN
  -- Valida se o link existe e não expirou
  SELECT * INTO v_link
  FROM public.links_coleta
  WHERE token = p_token
    AND expira_em > now();

  IF v_link.id IS NULL THEN
    RETURN false;
  END IF;

  -- Se for início de preenchimento, atualiza links_coleta caso ainda não tenha sido marcado
  IF p_acao = 'inicio_preenchimento' THEN
    UPDATE public.links_coleta
    SET iniciado_em = COALESCE(iniciado_em, now()),
        ip_origem = COALESCE(ip_origem, NULLIF(p_ip, '')),
        geolocalizacao = COALESCE(p_geolocalizacao, geolocalizacao),
        user_agent = COALESCE(NULLIF(p_user_agent, ''), user_agent)
    WHERE id = v_link.id;
  END IF;

  -- Registra no log imutável de auditoria
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
    v_link.organizacao_id,
    NULL,
    COALESCE(p_acao, 'inicio_preenchimento_coleta'),
    'links_coleta',
    v_link.id,
    NULLIF(p_ip, ''),
    jsonb_build_object(
      'token', p_token,
      'pessoa_id', v_link.pessoa_id,
      'geolocalizacao', p_geolocalizacao,
      'user_agent', p_user_agent,
      'detalhes_extras', p_detalhes
    ),
    now()
  );

  RETURN true;
END;
$$;
--> statement-breakpoint

REVOKE ALL ON FUNCTION public.registrar_auditoria_coleta(text, text, text, jsonb, text, jsonb) FROM PUBLIC;
--> statement-breakpoint

GRANT EXECUTE ON FUNCTION public.registrar_auditoria_coleta(text, text, text, jsonb, text, jsonb) TO anon, authenticated;
--> statement-breakpoint

-- 4. Função SECURITY DEFINER para registrar início de preenchimento na autoinscrição (/inscricao/[slug])
CREATE OR REPLACE FUNCTION public.registrar_auditoria_inscricao(
  p_slug text,
  p_acao text,
  p_ip text DEFAULT NULL,
  p_geolocalizacao jsonb DEFAULT NULL,
  p_user_agent text DEFAULT NULL,
  p_detalhes jsonb DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_org_id uuid;
BEGIN
  SELECT id INTO v_org_id
  FROM public.organizacoes
  WHERE slug = p_slug AND ativa;

  IF v_org_id IS NULL THEN
    RETURN false;
  END IF;

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
    COALESCE(p_acao, 'inicio_preenchimento_inscricao'),
    'organizacoes',
    v_org_id,
    NULLIF(p_ip, ''),
    jsonb_build_object(
      'slug', p_slug,
      'geolocalizacao', p_geolocalizacao,
      'user_agent', p_user_agent,
      'detalhes_extras', p_detalhes
    ),
    now()
  );

  RETURN true;
END;
$$;
--> statement-breakpoint

REVOKE ALL ON FUNCTION public.registrar_auditoria_inscricao(text, text, text, jsonb, text, jsonb) FROM PUBLIC;
--> statement-breakpoint

GRANT EXECUTE ON FUNCTION public.registrar_auditoria_inscricao(text, text, text, jsonb, text, jsonb) TO anon, authenticated;
--> statement-breakpoint

-- 5. Atualizar enviar_dados_coleta para gravar IP, geolocalização e log de auditoria na conclusão
DROP FUNCTION IF EXISTS public.enviar_dados_coleta(text, text, text, text, text, date, text, text);
--> statement-breakpoint

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
  p_user_agent text DEFAULT NULL
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
        'email', p_email IS NOT NULL AND p_email <> ''
      )
    ),
    now()
  );

  RETURN true;
END;
$$;
--> statement-breakpoint

REVOKE ALL ON FUNCTION public.enviar_dados_coleta(text, text, text, text, text, date, text, text, text, jsonb, text) FROM PUBLIC;
--> statement-breakpoint

GRANT EXECUTE ON FUNCTION public.enviar_dados_coleta(text, text, text, text, text, date, text, text, text, jsonb, text) TO anon, authenticated;
--> statement-breakpoint

-- Notificar PostgREST para recarregar o schema cache imediatamente
NOTIFY pgrst, 'reload schema';
