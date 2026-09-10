-- Adiciona token_assinatura na tabela contratos para viabilizar o fluxo
-- de assinatura pública por link enviado ao colaborador (sem exigir login no painel).
ALTER TABLE public.contratos ADD COLUMN IF NOT EXISTS token_assinatura text UNIQUE;
--> statement-breakpoint

-- Valida o link de assinatura e retorna os dados essenciais para visualização do contrato
CREATE OR REPLACE FUNCTION public.validar_link_assinatura(p_token text)
RETURNS TABLE (
  contrato_id uuid,
  pessoa_id uuid,
  nome_completo text,
  primeiro_nome text,
  cpf text,
  objeto text,
  valor numeric,
  valor_extenso text,
  vigencia_inicio date,
  vigencia_fim date,
  status public.status_contrato,
  organizacao_nome text,
  caminho_pdf text,
  assinado_em timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id AS contrato_id,
    p.id AS pessoa_id,
    p.nome_completo,
    split_part(p.nome_completo, ' ', 1) AS primeiro_nome,
    p.cpf,
    c.objeto,
    c.valor,
    c.valor_extenso,
    c.vigencia_inicio,
    c.vigencia_fim,
    c.status,
    o.nome AS organizacao_nome,
    c.caminho_pdf,
    c.assinado_em
  FROM public.contratos c
  JOIN public.pessoas p ON p.id = c.pessoa_id
  JOIN public.organizacoes o ON o.id = c.organizacao_id
  WHERE c.token_assinatura = p_token
    AND c.status IN ('enviado', 'assinado');
END;
$$;
--> statement-breakpoint

REVOKE ALL ON FUNCTION public.validar_link_assinatura(text) FROM PUBLIC;
--> statement-breakpoint

GRANT EXECUTE ON FUNCTION public.validar_link_assinatura(text) TO anon, authenticated;
--> statement-breakpoint

-- Efetua a assinatura pública do contrato registrando o evento na máquina de estados
CREATE OR REPLACE FUNCTION public.assinar_contrato_publico(
  p_token text,
  p_ip text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_contrato_id uuid;
  v_status_atual public.status_contrato;
BEGIN
  SELECT id, status INTO v_contrato_id, v_status_atual
  FROM public.contratos
  WHERE token_assinatura = p_token
  FOR UPDATE;

  IF v_contrato_id IS NULL THEN
    RETURN false;
  END IF;

  -- Se já estiver assinado, apenas confirma sucesso idempotente
  IF v_status_atual = 'assinado' THEN
    RETURN true;
  END IF;

  IF v_status_atual != 'enviado' THEN
    RETURN false;
  END IF;

  UPDATE public.contratos
  SET status = 'assinado',
      assinado_em = now()
  WHERE id = v_contrato_id;

  INSERT INTO public.eventos_contrato (
    contrato_id,
    status_anterior,
    status_novo,
    usuario_id,
    observacao
  ) VALUES (
    v_contrato_id,
    'enviado',
    'assinado',
    NULL,
    'Assinatura eletrônica realizada pelo colaborador via link seguro. IP: ' || COALESCE(NULLIF(p_ip, ''), 'não identificado')
  );

  RETURN true;
END;
$$;
--> statement-breakpoint

REVOKE ALL ON FUNCTION public.assinar_contrato_publico(text, text) FROM PUBLIC;
--> statement-breakpoint

GRANT EXECUTE ON FUNCTION public.assinar_contrato_publico(text, text) TO anon, authenticated;
