-- Achado real do gate de saída da Fase 2 ("transição inválida... rejeitada com
-- erro explicativo"): gravar_transicao_contrato (migration 0007) só checava
-- `WHERE status = status_anterior` (trava otimista), não se (status_anterior →
-- status_novo) é uma aresta válida do grafo — a validação real acontecia só na
-- camada de aplicação (canTransition, em src/lib/contratos/maquina-estados.ts),
-- ANTES de chamar a RPC. Testado na prática: um usuário autenticado comum
-- consegue chamar esta RPC diretamente (é `GRANT ... TO authenticated`, não
-- restrita a nenhum caminho de código específico) e pular de "emitido" direto
-- para "assinado", ignorando "enviado" por completo.
--
-- Duplicar o grafo aqui é deliberado: a validação em TypeScript continua a
-- primeira linha de defesa (dá erro mais cedo, com melhor mensagem pro
-- coordenador), mas o banco é quem garante que ninguém consegue pular por fora
-- dela — o mesmo princípio já aplicado a RLS e MFA neste projeto. Se o grafo de
-- src/lib/contratos/maquina-estados.ts mudar, este CASE precisa mudar junto.
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
DECLARE
  v_permitido boolean;
BEGIN
  v_permitido := CASE p_status_anterior
    WHEN 'rascunho' THEN p_status_novo IN ('emitido', 'cancelado')
    WHEN 'emitido' THEN p_status_novo IN ('enviado', 'cancelado')
    WHEN 'enviado' THEN p_status_novo IN ('assinado', 'cancelado')
    WHEN 'assinado' THEN p_status_novo IN ('distratado', 'encerrado')
    WHEN 'distratado' THEN p_status_novo IN ('distrato_assinado')
    ELSE false
  END;

  IF NOT v_permitido THEN
    RAISE EXCEPTION 'Transição inválida: o contrato está em "%" e não pode ir para "%".',
      p_status_anterior, p_status_novo;
  END IF;

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
