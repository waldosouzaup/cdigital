-- Reestruturação de acesso: MFA/TOTP deixa de ser OBRIGATÓRIO.
--
-- O modelo original (PROMPT Seção 3) exigia `aal2` para gestor/coord_comite via
-- policies RESTRITIVAS `*_mfa` em todas as tabelas + Storage. Na operação real isso
-- travou o dia a dia do administrador (login por link mágico + limite de e-mail do
-- Supabase + fricção do TOTP). Decisão registrada com o coordenador: login passa a
-- ser e-mail + senha e o TOTP vira camada OPCIONAL (tela "Segurança"), sem trava no
-- RLS.
--
-- Estas policies são RESTRITIVAS: removê-las só AFROUXA (tira um AND). As policies
-- permissivas de organização/região/papel continuam gateando tudo — nenhum dado
-- novo passa a vazar; o que sai é apenas a exigência de `aal2`.

DROP POLICY "organizacoes_mfa" ON public.organizacoes;
--> statement-breakpoint
DROP POLICY "regioes_mfa" ON public.regioes;
--> statement-breakpoint
DROP POLICY "usuarios_mfa" ON public.usuarios;
--> statement-breakpoint
DROP POLICY "pessoas_mfa" ON public.pessoas;
--> statement-breakpoint
DROP POLICY "templates_contrato_mfa" ON public.templates_contrato;
--> statement-breakpoint
DROP POLICY "contratos_mfa" ON public.contratos;
--> statement-breakpoint
DROP POLICY "eventos_contrato_mfa" ON public.eventos_contrato;
--> statement-breakpoint
DROP POLICY "documentos_mfa" ON public.documentos;
--> statement-breakpoint
DROP POLICY "registros_atividade_mfa" ON public.registros_atividade;
--> statement-breakpoint
DROP POLICY "links_coleta_mfa" ON public.links_coleta;
--> statement-breakpoint
DROP POLICY "notificacoes_mfa" ON public.notificacoes;
--> statement-breakpoint
DROP POLICY "expurgos_mfa" ON public.expurgos;
--> statement-breakpoint
DROP POLICY "log_auditoria_mfa" ON public.log_auditoria;
--> statement-breakpoint
DROP POLICY "MFA obrigatório para gestor e coord_comite — storage" ON storage.objects;
