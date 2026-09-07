/**
 * Chave de idempotência de notificações — Seção 6, regra 1 do PROMPT-Comite-Digital.md.
 *
 * Determinística por construção: mesma entrada, mesma chave, sempre. É o índice único
 * em `notificacoes.chave_idempotencia` que efetivamente impede o envio duplicado — esta
 * função só monta o valor de forma consistente.
 *
 * Exemplos da Seção 6: `contrato_enviado:{contrato_id}`,
 * `vigencia_a_vencer:{contrato_id}:7d`.
 */
// Mesmos valores do enum `tipo_notificacao` da Seção 5. Fica local (em vez de importar
// de src/db/schema) porque esta função é pura e não deve depender do schema do banco.
export type TipoNotificacao =
  | "link_coleta"
  | "documento_rejeitado"
  | "contrato_enviado"
  | "lembrete_assinatura"
  | "vigencia_a_vencer"
  | "resumo_diario"
  | "pessoa_apta";

export function chaveIdempotencia(
  tipo: TipoNotificacao,
  entidadeId: string,
  ...segmentosExtras: string[]
): string {
  return [tipo, entidadeId, ...segmentosExtras].join(":");
}
