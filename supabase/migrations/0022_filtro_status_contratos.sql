-- Migration 0022: Adiciona suporte ao filtro por status em buscar_contratos_paginados

-- Remove a assinatura antiga de 4 parâmetros para unificar na função com valor padrão
DROP FUNCTION IF EXISTS public.buscar_contratos_paginados(text, text, integer, integer);
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.buscar_contratos_paginados(
  p_busca text DEFAULT '',
  p_aba text DEFAULT 'ativos',
  p_pagina integer DEFAULT 1,
  p_limite integer DEFAULT 20,
  p_status text DEFAULT ''
) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  WITH filtro AS MATERIALIZED (
    SELECT c.id, c.criado_em, c.status
    FROM public.contratos c JOIN public.pessoas p ON p.id = c.pessoa_id
    WHERE (coalesce(btrim(p_busca), '') = ''
      OR strpos(lower(p.nome_completo), lower(btrim(left(p_busca, 120)))) > 0
      OR strpos(lower(coalesce(p.email, '')), lower(btrim(left(p_busca, 120)))) > 0
      OR (regexp_replace(p_busca, '[^0-9]', '', 'g') <> '' AND p_busca !~ '[[:alpha:]]' AND (
        strpos(regexp_replace(p.cpf, '[^0-9]', '', 'g'), regexp_replace(p_busca, '[^0-9]', '', 'g')) > 0
        OR strpos(regexp_replace(coalesce(p.telefone, ''), '[^0-9]', '', 'g'), regexp_replace(p_busca, '[^0-9]', '', 'g')) > 0)))
      AND (coalesce(btrim(p_status), '') IN ('', 'todos') OR c.status::text = btrim(p_status))
  ), totais AS (
    SELECT count(*) FILTER (WHERE status NOT IN ('distratado','distrato_assinado')) AS ativos,
      count(*) FILTER (WHERE status IN ('distratado','distrato_assinado')) AS distratos FROM filtro
  ), limites AS (
    SELECT *, CASE WHEN p_aba = 'distratos' THEN distratos ELSE ativos END AS total,
      greatest(1, least(coalesce(p_limite,20),100)) AS tamanho FROM totais
  ), paginacao AS (
    SELECT *, greatest(1,least(coalesce(p_pagina,1),ceil(total::numeric/tamanho)::integer)) AS pagina FROM limites
  ), ids AS (
    SELECT f.id FROM filtro f WHERE (f.status IN ('distratado','distrato_assinado')) = (p_aba = 'distratos')
    ORDER BY f.criado_em DESC, f.id DESC
    LIMIT (SELECT tamanho FROM paginacao) OFFSET (SELECT (pagina-1)*tamanho FROM paginacao)
  )
  SELECT jsonb_build_object('ativos',a.ativos,'distratos',a.distratos,'total',a.total,'pagina',a.pagina,'itens',
    coalesce((SELECT jsonb_agg(jsonb_build_object(
      'id',c.id,'pessoa_id',c.pessoa_id,'objeto',c.objeto,'valor',c.valor,'valor_extenso',c.valor_extenso,
      'vigencia_inicio',c.vigencia_inicio,'vigencia_fim',c.vigencia_fim,'status',c.status,
      'canal_envio',c.canal_envio,'enviado_para',c.enviado_para,'caminho_pdf',c.caminho_pdf,
      'caminho_pdf_assinado',c.caminho_pdf_assinado,'caminho_termo_distrato',c.caminho_termo_distrato,
      'pessoas',jsonb_build_object('nome_completo',p.nome_completo,'cpf',p.cpf,'email',p.email,'telefone',p.telefone),
      'regioes',jsonb_build_object('nome',r.nome)) ORDER BY c.criado_em DESC,c.id DESC)
      FROM ids JOIN public.contratos c USING(id) JOIN public.pessoas p ON p.id=c.pessoa_id
      LEFT JOIN public.regioes r ON r.id=c.regiao_id),'[]'::jsonb)) FROM paginacao a;
$$;
--> statement-breakpoint

REVOKE ALL ON FUNCTION public.buscar_contratos_paginados(text,text,integer,integer,text) FROM PUBLIC, anon;
--> statement-breakpoint

GRANT EXECUTE ON FUNCTION public.buscar_contratos_paginados(text,text,integer,integer,text) TO authenticated;
