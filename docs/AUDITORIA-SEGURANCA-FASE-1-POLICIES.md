# Policies declaradas — complemento da Fase 1

Reconstrução estática por ordem dos nomes das migrations. Não é dump do banco. São 29 policies nas 14 tabelas de negócio e cinco em storage.objects. Policies removidas não estão reproduzidas. Ver contexto e limites no [relatório principal](AUDITORIA-SEGURANCA-FASE-1.md).

## public.contratos — contratos_mutacao_gestor_coord

Origem: [supabase/migrations/0016_gestao_acessos.sql:162](</home/waldo/Projetos/ComiteDigital/supabase/migrations/0016_gestao_acessos.sql:162>).

```sql
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
```

## public.contratos — contratos_select

Origem: [supabase/migrations/0016_gestao_acessos.sql:154](</home/waldo/Projetos/ComiteDigital/supabase/migrations/0016_gestao_acessos.sql:154>).

```sql
CREATE POLICY contratos_select ON public.contratos
  FOR SELECT TO authenticated
  USING (
    organizacao_id = (SELECT public.organizacao_id())
    AND ((SELECT public.papel()) <> 'coord_regiao' OR regiao_id = (SELECT public.regiao_id()))
  );
```

## public.dados_excluidos — dados_excluidos_insert

Origem: [supabase/migrations/0021_dados_excluidos.sql:37](</home/waldo/Projetos/ComiteDigital/supabase/migrations/0021_dados_excluidos.sql:37>).

```sql
CREATE POLICY dados_excluidos_insert ON public.dados_excluidos
  FOR INSERT TO authenticated
  WITH CHECK (organizacao_id = (SELECT public.organizacao_id()));
```

## public.dados_excluidos — dados_excluidos_mfa

Origem: [supabase/migrations/0021_dados_excluidos.sql:42](</home/waldo/Projetos/ComiteDigital/supabase/migrations/0021_dados_excluidos.sql:42>).

```sql
CREATE POLICY dados_excluidos_mfa ON public.dados_excluidos
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (
    (SELECT public.papel()) NOT IN ('gestor', 'coord_comite')
    OR ((SELECT auth.jwt()) ->> 'aal') = 'aal2'
  )
  WITH CHECK (
    (SELECT public.papel()) NOT IN ('gestor', 'coord_comite')
    OR ((SELECT auth.jwt()) ->> 'aal') = 'aal2'
  );
```

## public.dados_excluidos — dados_excluidos_select

Origem: [supabase/migrations/0021_dados_excluidos.sql:32](</home/waldo/Projetos/ComiteDigital/supabase/migrations/0021_dados_excluidos.sql:32>).

```sql
CREATE POLICY dados_excluidos_select ON public.dados_excluidos
  FOR SELECT TO authenticated
  USING (organizacao_id = (SELECT public.organizacao_id()));
```

## public.documentos — documentos_mutacao_gestor_coord

Origem: [supabase/migrations/0016_gestao_acessos.sql:139](</home/waldo/Projetos/ComiteDigital/supabase/migrations/0016_gestao_acessos.sql:139>).

```sql
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
```

## public.documentos — documentos_select

Origem: [supabase/migrations/0016_gestao_acessos.sql:131](</home/waldo/Projetos/ComiteDigital/supabase/migrations/0016_gestao_acessos.sql:131>).

```sql
CREATE POLICY documentos_select ON public.documentos
  FOR SELECT TO authenticated
  USING (
    organizacao_id = (SELECT public.organizacao_id())
    AND ((SELECT public.papel()) <> 'coord_regiao' OR regiao_id = (SELECT public.regiao_id()))
  );
```

## public.eventos_contrato — eventos_contrato_organizacao_insert

Origem: [supabase/migrations/0002_tearful_vindicator.sql:25](</home/waldo/Projetos/ComiteDigital/supabase/migrations/0002_tearful_vindicator.sql:25>).

```sql
CREATE POLICY "eventos_contrato_organizacao_insert" ON "eventos_contrato" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (exists (select 1 from contratos c where c.id = "eventos_contrato"."contrato_id" and c.organizacao_id = (select public.organizacao_id())));
```

## public.eventos_contrato — eventos_contrato_organizacao_select

Origem: [supabase/migrations/0002_tearful_vindicator.sql:24](</home/waldo/Projetos/ComiteDigital/supabase/migrations/0002_tearful_vindicator.sql:24>).

```sql
CREATE POLICY "eventos_contrato_organizacao_select" ON "eventos_contrato" AS PERMISSIVE FOR SELECT TO "authenticated" USING (exists (select 1 from contratos c where c.id = "eventos_contrato"."contrato_id" and c.organizacao_id = (select public.organizacao_id())));
```

## public.expurgos — expurgos_organizacao_insert

Origem: [supabase/migrations/0013_retencao_expurgo.sql:34](</home/waldo/Projetos/ComiteDigital/supabase/migrations/0013_retencao_expurgo.sql:34>).

```sql
CREATE POLICY expurgos_organizacao_insert ON public.expurgos
  FOR INSERT TO authenticated
  WITH CHECK (organizacao_id = (SELECT public.organizacao_id()));
```

## public.expurgos — expurgos_organizacao_select

Origem: [supabase/migrations/0013_retencao_expurgo.sql:29](</home/waldo/Projetos/ComiteDigital/supabase/migrations/0013_retencao_expurgo.sql:29>).

```sql
CREATE POLICY expurgos_organizacao_select ON public.expurgos
  FOR SELECT TO authenticated
  USING (organizacao_id = (SELECT public.organizacao_id()));
```

## public.links_coleta — links_coleta_organizacao

Origem: [supabase/migrations/0002_tearful_vindicator.sql:22](</home/waldo/Projetos/ComiteDigital/supabase/migrations/0002_tearful_vindicator.sql:22>).

```sql
CREATE POLICY "links_coleta_organizacao" ON "links_coleta" AS PERMISSIVE FOR ALL TO "authenticated" USING ("links_coleta"."organizacao_id" = (select public.organizacao_id())) WITH CHECK ("links_coleta"."organizacao_id" = (select public.organizacao_id()));
```

## public.log_auditoria — log_auditoria_organizacao_insert

Origem: [supabase/migrations/0002_tearful_vindicator.sql:20](</home/waldo/Projetos/ComiteDigital/supabase/migrations/0002_tearful_vindicator.sql:20>).

```sql
CREATE POLICY "log_auditoria_organizacao_insert" ON "log_auditoria" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("log_auditoria"."organizacao_id" = (select public.organizacao_id()));
```

## public.log_auditoria — log_auditoria_organizacao_select

Origem: [supabase/migrations/0002_tearful_vindicator.sql:19](</home/waldo/Projetos/ComiteDigital/supabase/migrations/0002_tearful_vindicator.sql:19>).

```sql
CREATE POLICY "log_auditoria_organizacao_select" ON "log_auditoria" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("log_auditoria"."organizacao_id" = (select public.organizacao_id()));
```

## public.notificacoes — notificacoes_organizacao

Origem: [supabase/migrations/0002_tearful_vindicator.sql:33](</home/waldo/Projetos/ComiteDigital/supabase/migrations/0002_tearful_vindicator.sql:33>).

```sql
CREATE POLICY "notificacoes_organizacao" ON "notificacoes" AS PERMISSIVE FOR ALL TO "authenticated" USING ("notificacoes"."organizacao_id" = (select public.organizacao_id())) WITH CHECK ("notificacoes"."organizacao_id" = (select public.organizacao_id()));
```

## public.organizacoes — organizacoes_insert_superadmin

Origem: [supabase/migrations/0023_papel_superadmin.sql:22](</home/waldo/Projetos/ComiteDigital/supabase/migrations/0023_papel_superadmin.sql:22>).

```sql
CREATE POLICY "organizacoes_insert_superadmin" ON public.organizacoes
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT public.papel()) = 'superadmin'
  );
```

## public.organizacoes — organizacoes_select

Origem: [supabase/migrations/0023_papel_superadmin.sql:11](</home/waldo/Projetos/ComiteDigital/supabase/migrations/0023_papel_superadmin.sql:11>).

```sql
CREATE POLICY "organizacoes_select" ON public.organizacoes
  FOR SELECT TO authenticated
  USING (
    id = (SELECT public.organizacao_id())
    OR (SELECT public.papel()) = 'superadmin'
  );
```

## public.organizacoes — organizacoes_update_gestor

Origem: [supabase/migrations/0023_papel_superadmin.sql:32](</home/waldo/Projetos/ComiteDigital/supabase/migrations/0023_papel_superadmin.sql:32>).

```sql
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
```

## public.pessoas — pessoas_organizacao_regiao

Origem: [supabase/migrations/0002_tearful_vindicator.sql:37](</home/waldo/Projetos/ComiteDigital/supabase/migrations/0002_tearful_vindicator.sql:37>).

```sql
CREATE POLICY "pessoas_organizacao_regiao" ON "pessoas" AS PERMISSIVE FOR ALL TO "authenticated" USING ("pessoas"."organizacao_id" = (select public.organizacao_id()) AND ((select public.papel()) <> 'coord_regiao' OR "pessoas"."regiao_id" = (select public.regiao_id()))) WITH CHECK ("pessoas"."organizacao_id" = (select public.organizacao_id()) AND ((select public.papel()) <> 'coord_regiao' OR "pessoas"."regiao_id" = (select public.regiao_id())));
```

## public.regioes — regioes_insert_gestor

Origem: [supabase/migrations/0015_crud_regioes.sql:11](</home/waldo/Projetos/ComiteDigital/supabase/migrations/0015_crud_regioes.sql:11>).

```sql
CREATE POLICY regioes_insert_gestor ON public.regioes
  FOR INSERT TO authenticated
  WITH CHECK (
    organizacao_id = (SELECT public.organizacao_id())
    AND (SELECT public.papel()) = 'gestor'
  );
```

## public.regioes — regioes_select

Origem: [supabase/migrations/0002_tearful_vindicator.sql:39](</home/waldo/Projetos/ComiteDigital/supabase/migrations/0002_tearful_vindicator.sql:39>).

```sql
CREATE POLICY "regioes_select" ON "regioes" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("regioes"."organizacao_id" = (select public.organizacao_id()));
```

## public.regioes — regioes_update_gestor

Origem: [supabase/migrations/0015_crud_regioes.sql:19](</home/waldo/Projetos/ComiteDigital/supabase/migrations/0015_crud_regioes.sql:19>).

```sql
CREATE POLICY regioes_update_gestor ON public.regioes
  FOR UPDATE TO authenticated
  USING (
    organizacao_id = (SELECT public.organizacao_id())
    AND (SELECT public.papel()) = 'gestor'
  )
  WITH CHECK (
    organizacao_id = (SELECT public.organizacao_id())
    AND (SELECT public.papel()) = 'gestor'
  );
```

## public.registros_atividade — registros_atividade_organizacao_regiao

Origem: [supabase/migrations/0002_tearful_vindicator.sql:17](</home/waldo/Projetos/ComiteDigital/supabase/migrations/0002_tearful_vindicator.sql:17>).

```sql
CREATE POLICY "registros_atividade_organizacao_regiao" ON "registros_atividade" AS PERMISSIVE FOR ALL TO "authenticated" USING ("registros_atividade"."organizacao_id" = (select public.organizacao_id()) AND ((select public.papel()) <> 'coord_regiao' OR "registros_atividade"."regiao_id" = (select public.regiao_id()))) WITH CHECK ("registros_atividade"."organizacao_id" = (select public.organizacao_id()) AND ((select public.papel()) <> 'coord_regiao' OR "registros_atividade"."regiao_id" = (select public.regiao_id())));
```

## public.templates_contrato — templates_contrato_organizacao

Origem: [supabase/migrations/0002_tearful_vindicator.sql:27](</home/waldo/Projetos/ComiteDigital/supabase/migrations/0002_tearful_vindicator.sql:27>).

```sql
CREATE POLICY "templates_contrato_organizacao" ON "templates_contrato" AS PERMISSIVE FOR ALL TO "authenticated" USING ("templates_contrato"."organizacao_id" = (select public.organizacao_id())) WITH CHECK ("templates_contrato"."organizacao_id" = (select public.organizacao_id()));
```

## public.usuarios — Permite leitura pelo auth admin para o hook

Origem: [supabase/migrations/0001_auth_claims.sql:96](</home/waldo/Projetos/ComiteDigital/supabase/migrations/0001_auth_claims.sql:96>).

```sql
CREATE POLICY "Permite leitura pelo auth admin para o hook"
  ON public.usuarios
  AS PERMISSIVE
  FOR SELECT
  TO supabase_auth_admin
  USING (true);
```

## public.usuarios — usuarios_delete_gestor

Origem: [supabase/migrations/0023_papel_superadmin.sql:85](</home/waldo/Projetos/ComiteDigital/supabase/migrations/0023_papel_superadmin.sql:85>).

```sql
CREATE POLICY "usuarios_delete_gestor" ON public.usuarios
  FOR DELETE TO authenticated
  USING (
    (organizacao_id = (SELECT public.organizacao_id()) AND (SELECT public.papel()) = 'gestor')
    OR (SELECT public.papel()) = 'superadmin'
  );
```

## public.usuarios — usuarios_insert_gestor

Origem: [supabase/migrations/0023_papel_superadmin.sql:59](</home/waldo/Projetos/ComiteDigital/supabase/migrations/0023_papel_superadmin.sql:59>).

```sql
CREATE POLICY "usuarios_insert_gestor" ON public.usuarios
  FOR INSERT TO authenticated
  WITH CHECK (
    (organizacao_id = (SELECT public.organizacao_id()) AND (SELECT public.papel()) = 'gestor')
    OR (SELECT public.papel()) = 'superadmin'
  );
```

## public.usuarios — usuarios_select

Origem: [supabase/migrations/0023_papel_superadmin.sql:48](</home/waldo/Projetos/ComiteDigital/supabase/migrations/0023_papel_superadmin.sql:48>).

```sql
CREATE POLICY "usuarios_select" ON public.usuarios
  FOR SELECT TO authenticated
  USING (
    organizacao_id = (SELECT public.organizacao_id())
    OR (SELECT public.papel()) = 'superadmin'
  );
```

## public.usuarios — usuarios_update_gestor

Origem: [supabase/migrations/0023_papel_superadmin.sql:70](</home/waldo/Projetos/ComiteDigital/supabase/migrations/0023_papel_superadmin.sql:70>).

```sql
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
```

## storage.objects — Envio público via link de coleta — documentos

Origem: [supabase/migrations/0006_upload_coleta_publico.sql:84](</home/waldo/Projetos/ComiteDigital/supabase/migrations/0006_upload_coleta_publico.sql:84>).

```sql
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
```

## storage.objects — Escrita por organização — contratos

Origem: [supabase/migrations/0004_storage_policies.sql:41](</home/waldo/Projetos/ComiteDigital/supabase/migrations/0004_storage_policies.sql:41>).

```sql
CREATE POLICY "Escrita por organização — contratos"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'contratos'
    AND (storage.foldername(name))[1] = (select public.organizacao_id())::text
  );
```

## storage.objects — Escrita por organização — documentos

Origem: [supabase/migrations/0004_storage_policies.sql:23](</home/waldo/Projetos/ComiteDigital/supabase/migrations/0004_storage_policies.sql:23>).

```sql
CREATE POLICY "Escrita por organização — documentos"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'documentos'
    AND (storage.foldername(name))[1] = (select public.organizacao_id())::text
  );
```

## storage.objects — Leitura por organização — contratos

Origem: [supabase/migrations/0004_storage_policies.sql:32](</home/waldo/Projetos/ComiteDigital/supabase/migrations/0004_storage_policies.sql:32>).

```sql
CREATE POLICY "Leitura por organização — contratos"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'contratos'
    AND (storage.foldername(name))[1] = (select public.organizacao_id())::text
  );
```

## storage.objects — Leitura por organização — documentos

Origem: [supabase/migrations/0004_storage_policies.sql:14](</home/waldo/Projetos/ComiteDigital/supabase/migrations/0004_storage_policies.sql:14>).

```sql
CREATE POLICY "Leitura por organização — documentos"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'documentos'
    AND (storage.foldername(name))[1] = (select public.organizacao_id())::text
  );
```
