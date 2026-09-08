-- Fase 2, itens 8/10/11: emissão de contrato com PDF real e máquina de estados
-- gravando eventos_contrato em transação.

-- Gap da Fase 1: o bucket `contratos` já existia (Tarefa 7) sem nenhuma coluna em
-- `contratos` apontando pra ele.
ALTER TABLE public.contratos ADD COLUMN IF NOT EXISTS caminho_pdf text;
--> statement-breakpoint

ALTER TABLE public.contratos ADD COLUMN IF NOT EXISTS caminho_pdf_assinado text;
--> statement-breakpoint

-- "eventos_contrato em transação" (item 10): PostgREST não expõe transação entre
-- duas chamadas separadas do cliente (um .update() + um .insert() são duas
-- transações independentes). Uma função Postgres comum resolve isso — o corpo
-- inteiro roda atomicamente. SEM SECURITY DEFINER de propósito: quem chama é
-- sempre um usuário autenticado do painel, então a RLS de `contratos`/
-- `eventos_contrato` continua valendo normalmente (mesmo papel de quem invocou),
-- diferente das funções de acesso público de 0005/0006.
--
-- `WHERE status = p_status_anterior` funciona como trava otimista: se o status já
-- mudou entre a leitura (no servidor, antes de chamar esta função) e a gravação,
-- a atualização afeta 0 linhas, a função levanta erro e nada é inserido em
-- eventos_contrato — sem isso, duas transições concorrentes do mesmo contrato
-- poderiam gravar dois eventos conflitantes.
CREATE OR REPLACE FUNCTION public.gravar_transicao_contrato(
  p_contrato_id uuid,
  p_status_anterior status_contrato,
  p_status_novo status_contrato,
  p_observacao text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  UPDATE public.contratos
  SET status = p_status_novo,
      emitido_em = CASE WHEN p_status_novo = 'emitido' THEN now() ELSE emitido_em END,
      enviado_em = CASE WHEN p_status_novo = 'enviado' THEN now() ELSE enviado_em END,
      assinado_em = CASE WHEN p_status_novo = 'assinado' THEN now() ELSE assinado_em END
  WHERE id = p_contrato_id AND status = p_status_anterior;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contrato não encontrado, ou o status mudou entre a leitura e esta gravação.';
  END IF;

  INSERT INTO public.eventos_contrato (contrato_id, status_anterior, status_novo, usuario_id, observacao)
  VALUES (p_contrato_id, p_status_anterior, p_status_novo, (SELECT auth.uid()), p_observacao);
END;
$$;
--> statement-breakpoint

REVOKE ALL ON FUNCTION public.gravar_transicao_contrato(uuid, status_contrato, status_contrato, text) FROM PUBLIC;
--> statement-breakpoint

GRANT EXECUTE ON FUNCTION public.gravar_transicao_contrato(uuid, status_contrato, status_contrato, text) TO authenticated;
