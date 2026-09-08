-- Item 2 do feedback do coordenador: cadastro de Região de Atuação.
--
-- `regioes` só tinha policy de SELECT (Fase 1) — as regiões vinham só do seed
-- (Seção 11). Estas policies permissivas liberam o **gestor** a criar e renomear
-- regiões da PRÓPRIA organização. A restritiva de MFA (`regioes_mfa`, Fase 1)
-- continua valendo por cima.
--
-- Não há DELETE de propósito: `pessoas`, `contratos`, `registros_atividade`,
-- `documentos` e `usuarios` referenciam `regioes` por FK — apagar uma região em
-- uso quebraria a integridade. Renomear cobre a necessidade prática.
CREATE POLICY regioes_insert_gestor ON public.regioes
  FOR INSERT TO authenticated
  WITH CHECK (
    organizacao_id = (SELECT public.organizacao_id())
    AND (SELECT public.papel()) = 'gestor'
  );
--> statement-breakpoint

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
