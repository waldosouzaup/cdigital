-- Migration 0024: Tabela funcoes_pretendidas e políticas de exclusão para regiões e funções
-- Permite que o administrador/gestor gerencie (CRUD completo) o catálogo de funções pretendidas
-- e exclua regiões sem vínculos ativos, refletindo dinamicamente no formulário público de inscrição.

-- 1. Criação da tabela funcoes_pretendidas
CREATE TABLE IF NOT EXISTS public.funcoes_pretendidas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  nome text NOT NULL,
  descricao text,
  ativa boolean NOT NULL DEFAULT true,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS funcoes_pretendidas_org_nome_idx
  ON public.funcoes_pretendidas (organizacao_id, lower(trim(nome)));
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS funcoes_pretendidas_org_ativa_idx
  ON public.funcoes_pretendidas (organizacao_id, ativa);
--> statement-breakpoint

-- 2. Habilitação de RLS para funcoes_pretendidas
ALTER TABLE public.funcoes_pretendidas ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

CREATE POLICY "funcoes_select" ON public.funcoes_pretendidas
  FOR SELECT TO authenticated
  USING (
    organizacao_id = (SELECT public.organizacao_id())
    OR (SELECT public.papel()) = 'superadmin'
  );
--> statement-breakpoint

CREATE POLICY "funcoes_insert_gestor" ON public.funcoes_pretendidas
  FOR INSERT TO authenticated
  WITH CHECK (
    (organizacao_id = (SELECT public.organizacao_id()) AND (SELECT public.papel()) = 'gestor')
    OR (SELECT public.papel()) = 'superadmin'
  );
--> statement-breakpoint

CREATE POLICY "funcoes_update_gestor" ON public.funcoes_pretendidas
  FOR UPDATE TO authenticated
  USING (
    (organizacao_id = (SELECT public.organizacao_id()) AND (SELECT public.papel()) = 'gestor')
    OR (SELECT public.papel()) = 'superadmin'
  )
  WITH CHECK (
    (organizacao_id = (SELECT public.organizacao_id()) AND (SELECT public.papel()) = 'gestor')
    OR (SELECT public.papel()) = 'superadmin'
  );
--> statement-breakpoint

CREATE POLICY "funcoes_delete_gestor" ON public.funcoes_pretendidas
  FOR DELETE TO authenticated
  USING (
    (organizacao_id = (SELECT public.organizacao_id()) AND (SELECT public.papel()) = 'gestor')
    OR (SELECT public.papel()) = 'superadmin'
  );
--> statement-breakpoint

GRANT SELECT, INSERT, UPDATE, DELETE ON public.funcoes_pretendidas TO authenticated;
--> statement-breakpoint

-- 3. Adiciona política de DELETE em public.regioes para completar o CRUD
DROP POLICY IF EXISTS "regioes_delete_gestor" ON public.regioes;
--> statement-breakpoint

CREATE POLICY "regioes_delete_gestor" ON public.regioes
  FOR DELETE TO authenticated
  USING (
    (organizacao_id = (SELECT public.organizacao_id()) AND (SELECT public.papel()) = 'gestor')
    OR (SELECT public.papel()) = 'superadmin'
  );
--> statement-breakpoint

-- 4. Atualiza a RPC dados_inscricao_publica para consumir as funções ativas cadastradas
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

  funcoes := (
    SELECT coalesce(
      (
        SELECT jsonb_agg(f.nome ORDER BY f.nome)
        FROM public.funcoes_pretendidas f
        WHERE f.organizacao_id = v_org_id AND f.ativa
      ),
      (
        SELECT jsonb_agg(DISTINCT t.objeto)
        FROM public.templates_contrato t
        WHERE t.organizacao_id = v_org_id AND t.ativo
      ),
      jsonb_build_array(
        'Administrativo e Montagem de Material',
        'Coordenador de Comitê da Campanha',
        'Administrativo Homeoffice',
        'Militância e Mobilização de Rua'
      )
    )
  );

  RETURN NEXT;
END;
$$;
--> statement-breakpoint

REVOKE ALL ON FUNCTION public.dados_inscricao_publica(text) FROM PUBLIC;
--> statement-breakpoint

GRANT EXECUTE ON FUNCTION public.dados_inscricao_publica(text) TO anon, authenticated;
