-- Triggers de manutenção + publicação Realtime — Seção 3, 3.1 e 5.

-- ---------------------------------------------------------------------------
-- atualizado_em sempre corrente, não importa qual cliente escreveu a linha
-- (Drizzle, PostgREST via supabase-js, ou um job) — Seção 5: "adicione ...
-- atualizado_em em todas".
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_atualizado_em() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.atualizado_em := now();
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  tabela text;
BEGIN
  FOREACH tabela IN ARRAY ARRAY[
    'organizacoes', 'regioes', 'usuarios', 'pessoas', 'templates_contrato',
    'contratos', 'eventos_contrato', 'documentos', 'registros_atividade',
    'links_coleta', 'notificacoes', 'log_auditoria'
  ]
  LOOP
    EXECUTE format(
      'CREATE TRIGGER set_atualizado_em BEFORE UPDATE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION public.set_atualizado_em()',
      tabela
    );
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- regiao_id desnormalizado em contratos/documentos, sincronizado a partir de
-- pessoas.regiao_id — ver comentário em src/db/schema.ts. Evita a subconsulta por
-- linha que a Seção 3.1 pede para não fazer nas policies de RLS.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.sincronizar_regiao_da_pessoa() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  SELECT regiao_id INTO NEW.regiao_id FROM public.pessoas WHERE id = NEW.pessoa_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER sincronizar_regiao_contratos
  BEFORE INSERT OR UPDATE OF pessoa_id ON public.contratos
  FOR EACH ROW EXECUTE FUNCTION public.sincronizar_regiao_da_pessoa();

CREATE TRIGGER sincronizar_regiao_documentos
  BEFORE INSERT OR UPDATE OF pessoa_id ON public.documentos
  FOR EACH ROW EXECUTE FUNCTION public.sincronizar_regiao_da_pessoa();

-- Se a região da própria pessoa mudar depois, propaga para contratos/documentos já
-- existentes — sem isso, mudar a pessoa de região deixaria RLS antiga "grudada".
CREATE OR REPLACE FUNCTION public.propagar_mudanca_regiao_pessoa() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.regiao_id IS DISTINCT FROM OLD.regiao_id THEN
    UPDATE public.contratos SET regiao_id = NEW.regiao_id WHERE pessoa_id = NEW.id;
    UPDATE public.documentos SET regiao_id = NEW.regiao_id WHERE pessoa_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER propagar_mudanca_regiao_pessoa
  AFTER UPDATE OF regiao_id ON public.pessoas
  FOR EACH ROW EXECUTE FUNCTION public.propagar_mudanca_regiao_pessoa();

-- ---------------------------------------------------------------------------
-- Realtime — "Realtime respeita RLS, mas só se você habilitar" (Seção 3.1, item 3).
-- Guardado com verificação de idempotência: reaplicar esta migration não deve
-- falhar com "already member of publication".
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  tabela text;
BEGIN
  FOREACH tabela IN ARRAY ARRAY['contratos', 'pessoas', 'registros_atividade']
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = tabela
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tabela);
    END IF;
  END LOOP;
END $$;
