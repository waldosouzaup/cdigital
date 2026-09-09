-- Ajuste de Estrutura — Autoinscrição pública (Feature B).
--
-- Até aqui o link de coleta (`links_coleta`) era sempre por-pessoa: um coordenador
-- cadastrava a pessoa e só então gerava o link. Esta migration abre uma porta
-- pública e FIXA por organização — `/inscricao/[slug]` — onde o próprio candidato
-- se inscreve para uma vaga local. A inscrição cria a `pessoa` + um `links_coleta`
-- numa transação e a página emenda no fluxo `/coleta/[token]` já existente.
--
-- Mesmo desenho de 0005/0006: sem policy de RLS para `anon`, só funções
-- SECURITY DEFINER `SET search_path = ''` com `REVOKE ALL ... FROM PUBLIC` +
-- `GRANT EXECUTE ... TO anon, authenticated`.

-- ---------------------------------------------------------------------------
-- Colunas
-- ---------------------------------------------------------------------------

ALTER TABLE public.organizacoes ADD COLUMN slug text;
--> statement-breakpoint

-- Único global (não por organização): a URL `/inscricao/<slug>` não é
-- multi-tenant. Parcial para não colidir entre as várias linhas com slug NULL.
CREATE UNIQUE INDEX organizacoes_slug_idx ON public.organizacoes (slug) WHERE slug IS NOT NULL;
--> statement-breakpoint

-- Marca a origem do cadastro para a triagem distinguir autoinscritos. NULL = legado.
ALTER TABLE public.pessoas ADD COLUMN origem text;
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- dados_inscricao_publica — monta a tela pública (nome da campanha + listas de
-- região e função). Sem linha = slug inválido/inativo (a página mostra alerta).
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.dados_inscricao_publica(p_slug text)
RETURNS TABLE (
  organizacao_id uuid,
  organizacao_nome text,
  regioes jsonb,
  funcoes jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_org_id uuid;
  v_org_nome text;
BEGIN
  SELECT o.id, o.nome INTO v_org_id, v_org_nome
  FROM public.organizacoes o
  WHERE o.slug = p_slug AND o.ativa;

  IF v_org_id IS NULL THEN
    RETURN;
  END IF;

  organizacao_id := v_org_id;
  organizacao_nome := v_org_nome;

  regioes := (
    SELECT coalesce(
      jsonb_agg(jsonb_build_object('id', r.id, 'nome', r.nome) ORDER BY r.nome),
      '[]'::jsonb
    )
    FROM public.regioes r
    WHERE r.organizacao_id = v_org_id
  );

  funcoes := coalesce(
    (
      SELECT jsonb_agg(DISTINCT t.objeto)
      FROM public.templates_contrato t
      WHERE t.organizacao_id = v_org_id AND t.ativo
    ),
    -- Organização sem template ativo: catálogo padrão para o formulário nunca
    -- ficar sem opções (mesmos objetos do seed, Seção 11).
    jsonb_build_array(
      'Administrativo e Montagem de Material',
      'Coordenador de Comitê da Campanha',
      'Administrativo Homeoffice',
      'Militância e Mobilização de Rua'
    )
  );

  RETURN NEXT;
END;
$$;
--> statement-breakpoint

REVOKE ALL ON FUNCTION public.dados_inscricao_publica(text) FROM PUBLIC;
--> statement-breakpoint

GRANT EXECUTE ON FUNCTION public.dados_inscricao_publica(text) TO anon, authenticated;
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- inscrever_candidato — cria a pessoa (apta=false, origem='autoinscricao') e um
-- links_coleta na mesma transação, devolvendo o token. `erro` (código, não texto
-- de SQL cru) sinaliza as falhas esperadas; nenhum PII sai da função em caso de
-- CPF já existente. O token é gerado pela Server Action (gerarTokenColeta,
-- base64url) e passado em p_token — reaproveita o gerador já testado e mantém o
-- token compatível com o path /coleta/[token] e com storage.foldername.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.inscrever_candidato(
  p_slug text,
  p_nome text,
  p_cpf text,
  p_telefone text,
  p_email text,
  p_regiao_id uuid,
  p_funcao text,
  p_consentimento boolean,
  p_token text
)
RETURNS TABLE (token text, ja_existia boolean, erro text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_org uuid;
  v_pessoa uuid;
BEGIN
  token := null;
  ja_existia := false;
  erro := null;

  IF NOT coalesce(p_consentimento, false) THEN
    erro := 'consentimento';
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT o.id INTO v_org
  FROM public.organizacoes o
  WHERE o.slug = p_slug AND o.ativa;

  IF v_org IS NULL THEN
    erro := 'indisponivel';
    RETURN NEXT;
    RETURN;
  END IF;

  PERFORM 1 FROM public.regioes WHERE id = p_regiao_id AND organizacao_id = v_org;
  IF NOT FOUND THEN
    erro := 'regiao';
    RETURN NEXT;
    RETURN;
  END IF;

  BEGIN
    INSERT INTO public.pessoas (
      organizacao_id, nome_completo, cpf, telefone, email, regiao_id, funcao, apta, origem
    ) VALUES (
      v_org, p_nome, p_cpf, nullif(p_telefone, ''), nullif(p_email, ''),
      p_regiao_id, nullif(p_funcao, ''), false, 'autoinscricao'
    )
    RETURNING id INTO v_pessoa;
  EXCEPTION WHEN unique_violation THEN
    -- CPF já cadastrado nesta organização — reaproveita a pessoa e ainda assim
    -- gera um link novo, para o candidato conseguir enviar/reenviar documentos.
    -- Não lê nome_completo: nenhum dado da pessoa existente é devolvido.
    SELECT id INTO v_pessoa
    FROM public.pessoas
    WHERE organizacao_id = v_org AND cpf = p_cpf;
    ja_existia := true;
  END;

  INSERT INTO public.links_coleta (organizacao_id, pessoa_id, token, expira_em)
  VALUES (v_org, v_pessoa, p_token, now() + interval '7 days');

  token := p_token;
  RETURN NEXT;
END;
$$;
--> statement-breakpoint

REVOKE ALL ON FUNCTION public.inscrever_candidato(text, text, text, text, text, uuid, text, boolean, text) FROM PUBLIC;
--> statement-breakpoint

GRANT EXECUTE ON FUNCTION public.inscrever_candidato(text, text, text, text, text, uuid, text, boolean, text) TO anon, authenticated;
