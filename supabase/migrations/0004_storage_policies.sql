-- Policies de Storage — Seção 3.1: "todos os buckets são privados. O acesso se dá
-- exclusivamente por URL assinada... Aplique políticas de Storage por organizacao_id,
-- usando o primeiro segmento do caminho do objeto."
--
-- Nomenclatura do objeto (Fase 2, mas a policy já depende disso):
-- {organizacao_id}/{tipo}_{pessoa_id}_v{versao}.{ext} — por isso
-- (storage.foldername(name))[1] é sempre o organizacao_id.
--
-- `(select public.organizacao_id())`, não a chamada pura — achado do skill oficial
-- supabase-postgres-best-practices (referenced.md security-rls-performance):
-- envolver em `select` faz o Postgres avaliar a função uma vez por consulta em vez
-- de uma vez por linha.

CREATE POLICY "Leitura por organização — documentos"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'documentos'
    AND (storage.foldername(name))[1] = (select public.organizacao_id())::text
  );

CREATE POLICY "Escrita por organização — documentos"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'documentos'
    AND (storage.foldername(name))[1] = (select public.organizacao_id())::text
  );

CREATE POLICY "Leitura por organização — contratos"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'contratos'
    AND (storage.foldername(name))[1] = (select public.organizacao_id())::text
  );

CREATE POLICY "Escrita por organização — contratos"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'contratos'
    AND (storage.foldername(name))[1] = (select public.organizacao_id())::text
  );

-- Sem policy de UPDATE/DELETE para authenticated: reenvio de documento cria versão
-- nova (Fase 2, item 5), nunca sobrescreve ou apaga o objeto anterior. Expurgo
-- (Fase 4, retenção) roda via service_role, que ignora RLS.

-- MFA obrigatório para gestor/coord_comite (Seção 3, item 6) vale também para
-- Storage — mesma condição das policies em src/db/schema.ts.
CREATE POLICY "MFA obrigatório para gestor e coord_comite — storage"
  ON storage.objects
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING ((select public.papel()) NOT IN ('gestor', 'coord_comite') OR ((select auth.jwt()) ->> 'aal') = 'aal2')
  WITH CHECK ((select public.papel()) NOT IN ('gestor', 'coord_comite') OR ((select auth.jwt()) ->> 'aal') = 'aal2');
