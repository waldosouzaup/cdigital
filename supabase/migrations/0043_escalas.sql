-- Escalas de turno.
--
-- Não havia conceito de turno: evento contrata a mesma pessoa para três dias em
-- horários diferentes, e hoje isso vira três contratos ou nenhum controle.
-- `registros_atividade` não serve — registra o que JÁ foi feito, e escala é
-- compromisso futuro.
--
-- `inicio`/`fim` são timestamptz, não data + hora: turno de evento atravessa a
-- meia-noite com frequência (22h às 4h), e com colunas `time` separadas isso
-- exigiria uma flag "vira o dia" que todo cálculo teria de lembrar de consultar.

CREATE TABLE IF NOT EXISTS public.escalas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES public.organizacoes(id),
  pessoa_id uuid NOT NULL REFERENCES public.pessoas(id) ON DELETE CASCADE,
  regiao_id uuid REFERENCES public.regioes(id),
  contrato_id uuid REFERENCES public.contratos(id) ON DELETE SET NULL,
  inicio timestamptz NOT NULL,
  fim timestamptz NOT NULL,
  funcao text,
  local text,
  observacao text,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT escalas_intervalo_valido CHECK (fim > inicio)
);
--> statement-breakpoint

-- Listagem por dia e por pessoa é o acesso dominante da tela de escala.
CREATE INDEX IF NOT EXISTS escalas_organizacao_inicio_idx
  ON public.escalas (organizacao_id, inicio);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS escalas_pessoa_inicio_idx
  ON public.escalas (pessoa_id, inicio);
--> statement-breakpoint

ALTER TABLE public.escalas ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

-- Mesmo padrão das demais tabelas: isolamento por organização vem da claim do
-- JWT, não da aplicação.
CREATE POLICY escalas_organizacao ON public.escalas
  FOR ALL TO authenticated
  USING (organizacao_id = ((auth.jwt() -> 'app_metadata') ->> 'organizacao_id')::uuid)
  WITH CHECK (organizacao_id = ((auth.jwt() -> 'app_metadata') ->> 'organizacao_id')::uuid);
--> statement-breakpoint

COMMENT ON TABLE public.escalas IS
  'Turnos planejados. Compromisso futuro — o que foi efetivamente executado fica em registros_atividade.';
--> statement-breakpoint

-- Dupla marcação da mesma pessoa é o erro clássico de escala de evento, e não
-- adianta barrar só na aplicação: importação em lote e duas telas abertas
-- escapam. `btree_gist` permite combinar igualdade de uuid com sobreposição de
-- intervalo na mesma restrição de exclusão.
CREATE EXTENSION IF NOT EXISTS btree_gist;
--> statement-breakpoint

ALTER TABLE public.escalas
  ADD CONSTRAINT escalas_sem_sobreposicao
  EXCLUDE USING gist (
    pessoa_id WITH =,
    tstzrange(inicio, fim, '[)') WITH &&
  );
