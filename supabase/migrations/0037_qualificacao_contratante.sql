-- A CONTRATANTE deixa de morar no código.
--
-- `modelo-referencia.ts` e o termo de distrato padrão traziam escrita a
-- qualificação completa de uma candidata específica — nome, cargo, partido,
-- endereço e CNPJ. Toda organização nova, mesmo outra campanha, emitia contrato
-- com esses dados. Era defeito, não limitação: o sistema já é multi-tenant.
--
-- `qualificacao_contratante` é texto livre de propósito. A forma de qualificar
-- uma parte muda com o tipo de operação (candidatura, construtora, produtora de
-- evento) e nenhuma decomposição em colunas daria conta de todas; quem precisa
-- de redação própria escreve, quem não precisa recebe a composta a partir de
-- nome, CNPJ e endereço.

ALTER TABLE public.organizacoes
  ADD COLUMN IF NOT EXISTS endereco text,
  ADD COLUMN IF NOT EXISTS representante_nome text,
  ADD COLUMN IF NOT EXISTS representante_cargo text,
  ADD COLUMN IF NOT EXISTS qualificacao_contratante text;
--> statement-breakpoint

COMMENT ON COLUMN public.organizacoes.qualificacao_contratante IS
  'Redação integral da parte CONTRATANTE no contrato. Quando nula, é composta a partir de nome, CNPJ e endereço.';
--> statement-breakpoint

NOTIFY pgrst, 'reload schema';
