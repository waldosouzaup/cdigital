-- Fase 2, item 2: acesso público e não-autenticado a /coleta/[token] — sem JWT, sem
-- organizacao_id, então nenhuma policy de RLS para o papel `anon` resolveria isso sem
-- abrir a tabela inteira. Solução (já anotada em src/db/schema.ts na Fase 1): duas
-- funções SECURITY DEFINER que validam só o token — o mesmo padrão já usado em
-- custom_access_token_hook (0001_auth_claims.sql), não a service_role key da
-- aplicação (Seção 3.1 continua proibindo isso em rota que atende usuário).

-- Valida o token e devolve só o mínimo necessário para montar a tela (Seção 6: e-mail
-- de link_coleta não leva "nada além do primeiro nome" — a página também não).
CREATE OR REPLACE FUNCTION public.validar_link_coleta(p_token text)
RETURNS TABLE (pessoa_id uuid, primeiro_nome text, organizacao_nome text, expira_em timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT l.pessoa_id, split_part(p.nome_completo, ' ', 1), o.nome, l.expira_em
  FROM public.links_coleta l
  JOIN public.pessoas p ON p.id = l.pessoa_id
  JOIN public.organizacoes o ON o.id = l.organizacao_id
  WHERE l.token = p_token
    AND l.usado_em IS NULL
    AND l.expira_em > now();
END;
$$;
--> statement-breakpoint

REVOKE ALL ON FUNCTION public.validar_link_coleta(text) FROM PUBLIC;
--> statement-breakpoint

GRANT EXECUTE ON FUNCTION public.validar_link_coleta(text) TO anon, authenticated;
--> statement-breakpoint

-- Grava os dados que o contratado preencheu e marca o link como usado — "expiração
-- no uso" (Fase 2, item 2): o `FOR UPDATE` trava a linha para que dois envios
-- simultâneos do mesmo link não passem os dois.
CREATE OR REPLACE FUNCTION public.enviar_dados_coleta(
  p_token text,
  p_telefone text,
  p_endereco text,
  p_cep text,
  p_rg text,
  p_data_nascimento date,
  p_banco text,
  p_agencia text,
  p_conta text,
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
    banco = COALESCE(NULLIF(p_banco, ''), banco),
    agencia = COALESCE(NULLIF(p_agencia, ''), agencia),
    conta = COALESCE(NULLIF(p_conta, ''), conta),
    email = COALESCE(NULLIF(p_email, ''), email)
  WHERE id = v_pessoa_id;

  UPDATE public.links_coleta SET usado_em = now() WHERE token = p_token;

  RETURN true;
END;
$$;
--> statement-breakpoint

REVOKE ALL ON FUNCTION public.enviar_dados_coleta(text, text, text, text, text, date, text, text, text, text) FROM PUBLIC;
--> statement-breakpoint

GRANT EXECUTE ON FUNCTION public.enviar_dados_coleta(text, text, text, text, text, date, text, text, text, text) TO anon, authenticated;
