-- Fase 2, item 3: upload de documento pelo link público de coleta — sem sessão, sem
-- organizacao_id no JWT, mesmo desenho de 0005 (funções SECURITY DEFINER que validam
-- só o token, nunca a service_role da aplicação).

-- Integridade que ficou faltando desde a Fase 1 (o plano original previa isto, mas
-- não foi escrito em schema.ts): "reenvio cria versão + 1" (item 5) só é uma garantia
-- de verdade com um índice único — sem isso, dois envios concorrentes do mesmo tipo de
-- documento para a mesma pessoa poderiam colidir na mesma versão.
CREATE UNIQUE INDEX IF NOT EXISTS documentos_pessoa_tipo_versao_idx
  ON public.documentos (pessoa_id, tipo, versao);
--> statement-breakpoint

-- `validar_link_coleta` (0005) não devolvia organizacao_id — o upload precisa dele
-- para montar o caminho do objeto no Storage. Assinatura muda (nova coluna), por
-- isso DROP + CREATE em vez de CREATE OR REPLACE.
DROP FUNCTION IF EXISTS public.validar_link_coleta(text);
--> statement-breakpoint

-- `pessoa_email` entra aqui (não existia em 0005) para o Route Handler de upload
-- poder disparar `documento_rejeitado` sem precisar de outra função SECURITY
-- DEFINER só para isso — nunca é enviado ao HTML da página, só usado no servidor.
CREATE FUNCTION public.validar_link_coleta(p_token text)
RETURNS TABLE (
  pessoa_id uuid,
  organizacao_id uuid,
  primeiro_nome text,
  pessoa_email text,
  organizacao_nome text,
  expira_em timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT l.pessoa_id, l.organizacao_id, split_part(p.nome_completo, ' ', 1), p.email, o.nome, l.expira_em
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

-- Checa só se existe um link com este token+organização, ainda não expirado — usada
-- pela policy de Storage abaixo. Não checa `usado_em`: upload de documento pode
-- acontecer antes OU depois do envio dos dados complementares do mesmo link; só o
-- envio final (enviar_dados_coleta) consome o link.
CREATE OR REPLACE FUNCTION public.token_coleta_ativo_para_caminho(p_organizacao_id uuid, p_token text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.links_coleta l
    WHERE l.token = p_token
      AND l.organizacao_id = p_organizacao_id
      AND l.expira_em > now()
  );
$$;
--> statement-breakpoint

REVOKE ALL ON FUNCTION public.token_coleta_ativo_para_caminho(uuid, text) FROM PUBLIC;
--> statement-breakpoint

GRANT EXECUTE ON FUNCTION public.token_coleta_ativo_para_caminho(uuid, text) TO anon, authenticated;
--> statement-breakpoint

-- Caminho do objeto: {organizacao_id}/coleta/{token}/{tipo}_{pessoa_id}_v{versao}.{ext}
-- — o primeiro segmento continua sendo organizacao_id (compatível com as policies de
-- leitura autenticada já existentes em 0004_storage_policies.sql), o token vira o
-- terceiro segmento e é o que a policy abaixo valida.
CREATE POLICY "Envio público via link de coleta — documentos"
  ON storage.objects
  FOR INSERT
  TO anon
  WITH CHECK (
    bucket_id = 'documentos'
    AND (storage.foldername(name))[2] = 'coleta'
    AND public.token_coleta_ativo_para_caminho(
      (storage.foldername(name))[1]::uuid,
      (storage.foldername(name))[3]
    )
  );
--> statement-breakpoint

-- Valida o token, calcula a próxima versão e grava a linha em `documentos` — tudo
-- que o role `anon` não pode fazer direto (RLS de `documentos` só permite
-- `authenticated`). Hash duplicado dentro da organização é recusado apontando o
-- documento existente (Seção 5), não com stack trace.
CREATE FUNCTION public.registrar_documento_coleta(
  p_token text,
  p_tipo text,
  p_nome_original text,
  p_hash text,
  p_largura int,
  p_altura int,
  p_bytes bigint,
  p_ext text
)
RETURNS TABLE (
  documento_id uuid,
  caminho text,
  duplicado boolean,
  existente_tipo text,
  existente_criado_em timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_pessoa_id uuid;
  v_organizacao_id uuid;
  v_versao int;
BEGIN
  SELECT l.pessoa_id, l.organizacao_id INTO v_pessoa_id, v_organizacao_id
  FROM public.links_coleta l
  WHERE l.token = p_token AND l.expira_em > now()
  LIMIT 1;

  duplicado := false;
  existente_tipo := null;
  existente_criado_em := null;

  IF v_pessoa_id IS NULL THEN
    documento_id := null;
    caminho := null;
    RETURN NEXT;
    RETURN;
  END IF;

  -- Trava a combinação (pessoa, tipo) até o fim da transação: sem isso, dois
  -- envios concorrentes do mesmo tipo de documento poderiam calcular a mesma
  -- próxima versão e colidir no índice único criado acima.
  PERFORM pg_advisory_xact_lock(hashtext(v_pessoa_id::text || ':' || p_tipo));

  SELECT coalesce(max(d.versao), 0) + 1 INTO v_versao
  FROM public.documentos d
  WHERE d.pessoa_id = v_pessoa_id AND d.tipo = p_tipo;

  caminho := v_organizacao_id::text || '/coleta/' || p_token || '/' || p_tipo || '_' ||
             v_pessoa_id::text || '_v' || v_versao::text || '.' || p_ext;

  BEGIN
    INSERT INTO public.documentos (
      organizacao_id, pessoa_id, tipo, caminho_storage, nome_original,
      hash_sha256, largura_px, altura_px, bytes, versao, status
    ) VALUES (
      v_organizacao_id, v_pessoa_id, p_tipo, caminho, p_nome_original,
      p_hash, p_largura, p_altura, p_bytes, v_versao, 'pendente'
    )
    RETURNING id INTO documento_id;
  EXCEPTION WHEN unique_violation THEN
    duplicado := true;
    caminho := null;
    SELECT d.id, d.tipo, d.criado_em INTO documento_id, existente_tipo, existente_criado_em
    FROM public.documentos d
    WHERE d.organizacao_id = v_organizacao_id AND d.hash_sha256 = p_hash
    LIMIT 1;
  END;

  RETURN NEXT;
END;
$$;
--> statement-breakpoint

REVOKE ALL ON FUNCTION public.registrar_documento_coleta(text, text, text, text, int, int, bigint, text) FROM PUBLIC;
--> statement-breakpoint

GRANT EXECUTE ON FUNCTION public.registrar_documento_coleta(text, text, text, text, int, int, bigint, text) TO anon, authenticated;
