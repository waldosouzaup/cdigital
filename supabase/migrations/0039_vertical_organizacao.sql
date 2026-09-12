-- Vertical de atuação da organização.
--
-- O motor (pessoas, documentos, contratos, prazos, RLS, máquina de estados) não
-- sabe que existe eleição: nenhuma tabela, coluna ou enum nomeia campanha. O que
-- prende o produto ao domínio eleitoral é vocabulário de interface — "comitê",
-- "campanha", "região", "militância".
--
-- Esta coluna é o que permite renomear isso por organização sem tocar no banco:
-- o dicionário vive na aplicação (`src/lib/organizacao/vertical.ts`) e traduz
-- apenas o que a pessoa lê. Nenhuma tabela muda de nome, nenhum enum é migrado.
--
-- `papel_usuario` continua com `coord_comite` e `coord_regiao`: migrar enum em
-- Postgres é caro, arriscado e não compraria nada — o rótulo exibido já vem do
-- dicionário.

ALTER TABLE public.organizacoes
  ADD COLUMN IF NOT EXISTS vertical text NOT NULL DEFAULT 'campanha';
--> statement-breakpoint

ALTER TABLE public.organizacoes
  ADD CONSTRAINT organizacoes_vertical_valida
  CHECK (vertical IN ('campanha', 'evento', 'obra', 'varejo'));
--> statement-breakpoint

COMMENT ON COLUMN public.organizacoes.vertical IS
  'Define o vocabulário exibido na interface. Não altera schema, regras nem permissões.';
--> statement-breakpoint

NOTIFY pgrst, 'reload schema';
