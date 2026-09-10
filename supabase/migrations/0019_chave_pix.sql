-- Coleta: pagar por PIX, não por dados bancários.
--
-- O formulário público de coleta passa a pedir a CHAVE PIX (uma linha) no lugar de
-- banco/agência/conta (três). As colunas antigas ficam na tabela (dados legados),
-- só deixam de ser preenchidas. A RPC `enviar_dados_coleta` (0005) muda de
-- assinatura — DROP + CREATE, com novo REVOKE/GRANT.

ALTER TABLE public.pessoas ADD COLUMN chave_pix text;
--> statement-breakpoint

DROP FUNCTION IF EXISTS public.enviar_dados_coleta(text, text, text, text, text, date, text, text, text, text);
--> statement-breakpoint

CREATE FUNCTION public.enviar_dados_coleta(
  p_token text,
  p_telefone text,
  p_endereco text,
  p_cep text,
  p_rg text,
  p_data_nascimento date,
  p_chave_pix text,
  p_email text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_pessoa_id uuid;
BEGIN
  SELECT l.pessoa_id INTO v_pessoa_id
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

  UPDATE public.links_coleta SET usado_em = now() WHERE token = p_token;

  RETURN true;
END;
$$;
--> statement-breakpoint

REVOKE ALL ON FUNCTION public.enviar_dados_coleta(text, text, text, text, text, date, text, text) FROM PUBLIC;
--> statement-breakpoint

GRANT EXECUTE ON FUNCTION public.enviar_dados_coleta(text, text, text, text, text, date, text, text) TO anon, authenticated;
