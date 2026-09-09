-- Ajuste de Estrutura — Governança de Acesso (Feature A).
--
-- Até aqui o único jeito de criar um usuário era o CLI `src/db/provision-user.ts`
-- (service_role). Não havia tela, Server Action nem policy de INSERT em `usuarios`:
-- a policy `usuarios_organizacao` era `FOR ALL` para qualquer autenticado da
-- organização, sem trava de papel. Esta migration:
--
--   1. Adiciona `usuarios.ativo` (desativar acesso sem apagar a linha — há FKs de
--      eventos_contrato/log_auditoria/expurgos apontando para usuarios.id).
--   2. Índice único (organizacao_id, email) — um convite não cria duplicata.
--   3. CHECK: coord_regiao obrigatoriamente tem regiao_id.
--   4. Troca a policy `usuarios_organizacao` (FOR ALL) por SELECT tenant-scoped
--      para todos + INSERT/UPDATE/DELETE só para `gestor`. A restritiva
--      `usuarios_mfa` (Fase 1) e a policy de leitura do `supabase_auth_admin`
--      (migration 0001) continuam valendo.
--   5. `custom_access_token_hook` passa a filtrar `ativo IS TRUE` — usuário
--      desativado não recebe claim nenhuma no próximo token (mesmo caminho seguro
--      de "sem linha em usuarios").
--   6. Trava de papel em `documentos` e `contratos`: aprovar documento e emitir/
--      transicionar contrato passam a ser exclusivos de `gestor` e `coord_comite`
--      (decisão do coordenador). `coord_regiao` continua ENXERGANDO os registros
--      da sua região (policy de SELECT preservada), só não escreve mais.

-- ---------------------------------------------------------------------------
-- 1-3. Colunas / índice / constraint em usuarios
-- ---------------------------------------------------------------------------

ALTER TABLE public.usuarios ADD COLUMN ativo boolean NOT NULL DEFAULT true;
--> statement-breakpoint

CREATE UNIQUE INDEX usuarios_organizacao_id_email_idx
  ON public.usuarios (organizacao_id, email);
--> statement-breakpoint

ALTER TABLE public.usuarios ADD CONSTRAINT usuarios_regiao_obrigatoria_coord
  CHECK (papel <> 'coord_regiao' OR regiao_id IS NOT NULL);
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- 4. Policies de usuarios: SELECT p/ todos da org, escrita só p/ gestor
-- ---------------------------------------------------------------------------

DROP POLICY "usuarios_organizacao" ON public.usuarios;
--> statement-breakpoint

CREATE POLICY usuarios_select ON public.usuarios
  FOR SELECT TO authenticated
  USING (organizacao_id = (SELECT public.organizacao_id()));
--> statement-breakpoint

CREATE POLICY usuarios_insert_gestor ON public.usuarios
  FOR INSERT TO authenticated
  WITH CHECK (
    organizacao_id = (SELECT public.organizacao_id())
    AND (SELECT public.papel()) = 'gestor'
  );
--> statement-breakpoint

CREATE POLICY usuarios_update_gestor ON public.usuarios
  FOR UPDATE TO authenticated
  USING (
    organizacao_id = (SELECT public.organizacao_id())
    AND (SELECT public.papel()) = 'gestor'
  )
  WITH CHECK (
    organizacao_id = (SELECT public.organizacao_id())
    AND (SELECT public.papel()) = 'gestor'
  );
--> statement-breakpoint

CREATE POLICY usuarios_delete_gestor ON public.usuarios
  FOR DELETE TO authenticated
  USING (
    organizacao_id = (SELECT public.organizacao_id())
    AND (SELECT public.papel()) = 'gestor'
  );
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- 5. Hook do access token — corpo idêntico ao da migration 0001, com um único
--    acréscimo: `AND ativo IS TRUE` no lookup. Grants sobrevivem ao CREATE OR
--    REPLACE; a policy do supabase_auth_admin e a restritiva usuarios_mfa não
--    são tocadas.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  claims jsonb;
  usuario record;
BEGIN
  SELECT organizacao_id, papel, regiao_id
    INTO usuario
    FROM public.usuarios
   WHERE id = (event->>'user_id')::uuid
     AND ativo IS TRUE;

  claims := event->'claims';

  IF usuario IS NULL THEN
    -- Sem linha ativa em public.usuarios (provisionamento incompleto ou acesso
    -- desativado). Não injeta claim nenhuma; a RLS nega tudo por padrão
    -- (organizacao_id() retorna NULL), que é o comportamento seguro.
    RETURN event;
  END IF;

  claims := jsonb_set(claims, '{organizacao_id}', to_jsonb(usuario.organizacao_id));
  claims := jsonb_set(claims, '{papel}', to_jsonb(usuario.papel));

  IF usuario.regiao_id IS NOT NULL THEN
    claims := jsonb_set(claims, '{regiao_id}', to_jsonb(usuario.regiao_id));
  END IF;

  event := jsonb_set(event, '{claims}', claims);
  RETURN event;
END;
$$;
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- 6. Trava de papel em documentos e contratos
-- ---------------------------------------------------------------------------

DROP POLICY "documentos_organizacao_regiao" ON public.documentos;
--> statement-breakpoint

CREATE POLICY documentos_select ON public.documentos
  FOR SELECT TO authenticated
  USING (
    organizacao_id = (SELECT public.organizacao_id())
    AND ((SELECT public.papel()) <> 'coord_regiao' OR regiao_id = (SELECT public.regiao_id()))
  );
--> statement-breakpoint

CREATE POLICY documentos_mutacao_gestor_coord ON public.documentos
  FOR ALL TO authenticated
  USING (
    organizacao_id = (SELECT public.organizacao_id())
    AND (SELECT public.papel()) IN ('gestor', 'coord_comite')
  )
  WITH CHECK (
    organizacao_id = (SELECT public.organizacao_id())
    AND (SELECT public.papel()) IN ('gestor', 'coord_comite')
  );
--> statement-breakpoint

DROP POLICY "contratos_organizacao_regiao" ON public.contratos;
--> statement-breakpoint

CREATE POLICY contratos_select ON public.contratos
  FOR SELECT TO authenticated
  USING (
    organizacao_id = (SELECT public.organizacao_id())
    AND ((SELECT public.papel()) <> 'coord_regiao' OR regiao_id = (SELECT public.regiao_id()))
  );
--> statement-breakpoint

CREATE POLICY contratos_mutacao_gestor_coord ON public.contratos
  FOR ALL TO authenticated
  USING (
    organizacao_id = (SELECT public.organizacao_id())
    AND (SELECT public.papel()) IN ('gestor', 'coord_comite')
  )
  WITH CHECK (
    organizacao_id = (SELECT public.organizacao_id())
    AND (SELECT public.papel()) IN ('gestor', 'coord_comite')
  );
