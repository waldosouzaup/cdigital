-- Prestador pessoa jurídica.
--
-- `pessoas.cpf` era NOT NULL, então não cabia subcontratado PJ — o que barra
-- construção civil por inteiro, e também produtora terceirizada em evento.
--
-- Só remover o NOT NULL deixaria gravar pessoa sem identificação nenhuma. Em vez
-- disso, `tipo_pessoa` diz qual documento vale e o CHECK mantém a invariante no
-- banco: física exige CPF e recusa CNPJ; jurídica exige CNPJ e recusa CPF.
--
-- O CHECK é escrito com IS NULL / IS NOT NULL de propósito. Comparação com NULL
-- resulta NULL, e CHECK que avalia NULL APROVA a linha — foi assim que a
-- primeira versão da restrição de coordenada (0038) deixou passar meia
-- coordenada. Aqui nenhum ramo pode resultar NULL.

ALTER TABLE public.pessoas
  ADD COLUMN IF NOT EXISTS tipo_pessoa text NOT NULL DEFAULT 'fisica',
  ADD COLUMN IF NOT EXISTS cnpj text;
--> statement-breakpoint

ALTER TABLE public.pessoas
  ADD CONSTRAINT pessoas_tipo_valido CHECK (tipo_pessoa IN ('fisica', 'juridica'));
--> statement-breakpoint

ALTER TABLE public.pessoas ALTER COLUMN cpf DROP NOT NULL;
--> statement-breakpoint

ALTER TABLE public.pessoas
  ADD CONSTRAINT pessoas_identificacao_coerente CHECK (
    (tipo_pessoa = 'fisica' AND cpf IS NOT NULL AND cnpj IS NULL)
    OR (tipo_pessoa = 'juridica' AND cnpj IS NOT NULL AND cpf IS NULL)
  );
--> statement-breakpoint

-- O índice único de CPF continua valendo: em Postgres, NULLs não colidem entre
-- si num índice único, então linhas jurídicas (cpf nulo) não disputam a chave.
CREATE UNIQUE INDEX IF NOT EXISTS pessoas_organizacao_id_cnpj_idx
  ON public.pessoas (organizacao_id, cnpj)
  WHERE cnpj IS NOT NULL;
--> statement-breakpoint

COMMENT ON COLUMN public.pessoas.tipo_pessoa IS
  'fisica = CPF obrigatório; juridica = CNPJ obrigatório. A restrição pessoas_identificacao_coerente garante que exatamente um esteja preenchido.';
--> statement-breakpoint

NOTIFY pgrst, 'reload schema';
