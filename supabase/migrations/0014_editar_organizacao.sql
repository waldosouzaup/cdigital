-- Item 4 do feedback do coordenador: editar a identidade do comitê (nome + CNPJ).
--
-- `organizacoes` só tinha policy de SELECT (Fase 1) — nunca houve fluxo de edição.
-- Esta policy permissiva de UPDATE libera o **gestor** a alterar a PRÓPRIA
-- organização. A policy restritiva de MFA (`organizacoes_mfa`, Fase 1) continua
-- valendo por cima: o gestor precisa estar em aal2.
CREATE POLICY organizacoes_update_gestor ON public.organizacoes
  FOR UPDATE TO authenticated
  USING (
    id = (SELECT public.organizacao_id())
    AND (SELECT public.papel()) = 'gestor'
  )
  WITH CHECK (
    id = (SELECT public.organizacao_id())
    AND (SELECT public.papel()) = 'gestor'
  );
