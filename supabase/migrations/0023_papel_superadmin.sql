-- Migration 0023: Adiciona o papel 'superadmin' ao enum papel_usuario e atualiza políticas de RLS
-- Permite que o SuperAdmin configure campanhas (organizações) e provisione os primeiros gestores e equipes.

ALTER TYPE public.papel_usuario ADD VALUE IF NOT EXISTS 'superadmin';
--> statement-breakpoint

-- Atualiza políticas em public.organizacoes
DROP POLICY IF EXISTS "organizacoes_select" ON public.organizacoes;
--> statement-breakpoint

CREATE POLICY "organizacoes_select" ON public.organizacoes
  FOR SELECT TO authenticated
  USING (
    id = (SELECT public.organizacao_id())
    OR (SELECT public.papel()) = 'superadmin'
  );
--> statement-breakpoint

DROP POLICY IF EXISTS "organizacoes_insert_superadmin" ON public.organizacoes;
--> statement-breakpoint

CREATE POLICY "organizacoes_insert_superadmin" ON public.organizacoes
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT public.papel()) = 'superadmin'
  );
--> statement-breakpoint

DROP POLICY IF EXISTS "organizacoes_update_gestor" ON public.organizacoes;
--> statement-breakpoint

CREATE POLICY "organizacoes_update_gestor" ON public.organizacoes
  FOR UPDATE TO authenticated
  USING (
    (id = (SELECT public.organizacao_id()) AND (SELECT public.papel()) = 'gestor')
    OR (SELECT public.papel()) = 'superadmin'
  )
  WITH CHECK (
    (id = (SELECT public.organizacao_id()) AND (SELECT public.papel()) = 'gestor')
    OR (SELECT public.papel()) = 'superadmin'
  );
--> statement-breakpoint

-- Atualiza políticas em public.usuarios
DROP POLICY IF EXISTS "usuarios_select" ON public.usuarios;
--> statement-breakpoint

CREATE POLICY "usuarios_select" ON public.usuarios
  FOR SELECT TO authenticated
  USING (
    organizacao_id = (SELECT public.organizacao_id())
    OR (SELECT public.papel()) = 'superadmin'
  );
--> statement-breakpoint

DROP POLICY IF EXISTS "usuarios_insert_gestor" ON public.usuarios;
--> statement-breakpoint

CREATE POLICY "usuarios_insert_gestor" ON public.usuarios
  FOR INSERT TO authenticated
  WITH CHECK (
    (organizacao_id = (SELECT public.organizacao_id()) AND (SELECT public.papel()) = 'gestor')
    OR (SELECT public.papel()) = 'superadmin'
  );
--> statement-breakpoint

DROP POLICY IF EXISTS "usuarios_update_gestor" ON public.usuarios;
--> statement-breakpoint

CREATE POLICY "usuarios_update_gestor" ON public.usuarios
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

DROP POLICY IF EXISTS "usuarios_delete_gestor" ON public.usuarios;
--> statement-breakpoint

CREATE POLICY "usuarios_delete_gestor" ON public.usuarios
  FOR DELETE TO authenticated
  USING (
    (organizacao_id = (SELECT public.organizacao_id()) AND (SELECT public.papel()) = 'gestor')
    OR (SELECT public.papel()) = 'superadmin'
  );
--> statement-breakpoint

-- Concede privilégios necessários
GRANT SELECT, INSERT, UPDATE ON public.organizacoes TO authenticated;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON public.usuarios TO authenticated;
