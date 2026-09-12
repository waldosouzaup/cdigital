-- Assinatura eletrônica do termo de distrato.
--
-- O distrato terminava no PDF gerado pela coordenação: `distratado` só virava
-- `distrato_assinado` por marcação manual, sem nenhuma evidência de que a pessoa
-- tivesse concordado. O contrato de entrada já é assinado na tela com foto e
-- carimbo de tempo (migration 0020); a saída passa a ter o mesmo rigor.
--
-- Espelha deliberadamente `validar_link_assinatura` e
-- `concluir_assinatura_com_evidencias`: token próprio de 192 bits, capacidade
-- pública estrita, conclusão atômica com trava de linha e evento de transição na
-- mesma transação.

ALTER TABLE public.contratos
  ADD COLUMN IF NOT EXISTS token_assinatura_distrato text UNIQUE,
  ADD COLUMN IF NOT EXISTS assinatura_distrato_expira_em timestamptz,
  ADD COLUMN IF NOT EXISTS distrato_assinado_em timestamptz,
  ADD COLUMN IF NOT EXISTS caminho_termo_distrato_assinado text,
  ADD COLUMN IF NOT EXISTS distrato_assinatura_evidencias jsonb,
  ADD COLUMN IF NOT EXISTS termo_distrato_sha256 text;
--> statement-breakpoint

COMMENT ON COLUMN public.contratos.token_assinatura_distrato IS
  'Capacidade pública de 192 bits para assinar o termo de distrato. Distinta de token_assinatura: o link do contrato de entrada já foi consumido e não deve dar acesso à rescisão.';
--> statement-breakpoint

-- Leitura pública do termo a assinar. Só enxerga o contrato pelo token, dentro do
-- prazo e nos dois estados em que a tela faz sentido — `distratado` para assinar,
-- `distrato_assinado` para rever e baixar a via.
CREATE OR REPLACE FUNCTION public.validar_link_assinatura_distrato(p_token text)
RETURNS TABLE (
  contrato_id uuid, pessoa_id uuid, nome_completo text, primeiro_nome text, cpf text,
  objeto text, vigencia_inicio date, vigencia_fim date,
  status public.status_contrato, organizacao_nome text,
  caminho_termo text, termo_sha256 text, distrato_assinado_em timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT c.id, p.id, p.nome_completo, split_part(p.nome_completo, ' ', 1), p.cpf,
    c.objeto, c.vigencia_inicio, c.vigencia_fim, c.status, o.nome,
    CASE WHEN c.status = 'distrato_assinado'
      THEN coalesce(c.caminho_termo_distrato_assinado, c.caminho_termo_distrato)
      ELSE c.caminho_termo_distrato END,
    c.termo_distrato_sha256, c.distrato_assinado_em
  FROM public.contratos c
  JOIN public.pessoas p ON p.id = c.pessoa_id AND p.organizacao_id = c.organizacao_id
  JOIN public.organizacoes o ON o.id = c.organizacao_id
  WHERE p_token ~ '^[0-9a-f]{48}$'
    AND c.token_assinatura_distrato = p_token
    AND c.assinatura_distrato_expira_em > now()
    AND c.status IN ('distratado', 'distrato_assinado');
$$;
--> statement-breakpoint

REVOKE ALL ON FUNCTION public.validar_link_assinatura_distrato(text) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.validar_link_assinatura_distrato(text) TO anon, authenticated;
--> statement-breakpoint

-- Conclusão atômica: valida prazo, estado, hash do termo apresentado e o formato
-- do caminho do PDF, grava evidências e registra a transição no mesmo commit.
-- SECURITY INVOKER com trava explícita de papel, igual à do contrato: quem chama
-- é sempre a rota de servidor com a chave de serviço.
CREATE OR REPLACE FUNCTION public.concluir_assinatura_distrato_com_evidencias(
  p_token text, p_termo_sha256 text, p_caminho_pdf text, p_evidencias jsonb
) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE c public.contratos%ROWTYPE;
BEGIN
  IF current_user IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Operação exclusiva do servidor';
  END IF;

  SELECT * INTO c FROM public.contratos WHERE token_assinatura_distrato = p_token FOR UPDATE;

  IF c.id IS NULL
     OR c.assinatura_distrato_expira_em IS NULL
     OR c.assinatura_distrato_expira_em <= now() THEN
    RETURN false;
  END IF;

  -- Reentrada: resposta perdida depois do commit não pode virar erro na tela.
  IF c.status = 'distrato_assinado' AND c.distrato_assinatura_evidencias IS NOT NULL THEN
    RETURN true;
  END IF;

  IF c.status <> 'distratado' OR c.termo_distrato_sha256 IS DISTINCT FROM p_termo_sha256 THEN
    RETURN false;
  END IF;

  IF p_termo_sha256 !~ '^[0-9a-f]{64}$'
     OR p_evidencias->>'assinatura_sha256' IS NULL
     OR p_evidencias->>'foto_sha256' IS NULL
     OR coalesce(p_evidencias->>'consentimento', '') <> 'true'
     OR p_caminho_pdf NOT LIKE c.organizacao_id::text || '/' || c.pessoa_id::text
          || '/distrato_assinado_' || c.id::text || '_%.pdf' THEN
    RETURN false;
  END IF;

  UPDATE public.contratos SET
    status = 'distrato_assinado',
    distrato_assinado_em = now(),
    caminho_termo_distrato_assinado = p_caminho_pdf,
    distrato_assinatura_evidencias = p_evidencias
  WHERE id = c.id;

  INSERT INTO public.eventos_contrato(contrato_id, status_anterior, status_novo, usuario_id, observacao)
  VALUES (c.id, 'distratado', 'distrato_assinado', NULL,
    'Termo de distrato assinado na tela com foto do rosto registrada. SHA-256 do termo: ' || p_termo_sha256);

  RETURN true;
END;
$$;
--> statement-breakpoint

REVOKE ALL ON FUNCTION public.concluir_assinatura_distrato_com_evidencias(text,text,text,jsonb)
  FROM PUBLIC, anon, authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.concluir_assinatura_distrato_com_evidencias(text,text,text,jsonb)
  TO service_role;
--> statement-breakpoint

NOTIFY pgrst, 'reload schema';
