/**
 * Webhook do Resend — Seção 6, regra 5: atualiza `status` conforme o evento de
 * entrega.
 *
 * ATENÇÃO — divergência real entre Context 7 e o pacote instalado (registrada em
 * CONSULTAS.md): a primeira consulta ao Context 7 trouxe `email.bounce`/
 * `email.complaint` e um campo `data.id`, vindos da doc da branch `canary` do
 * `resend-node` (versão ainda não publicada). O `.d.ts` do pacote realmente
 * instalado (`resend@6.26.0`) usa `email.bounced`/`email.complained` e
 * `data.email_id` — conferido diretamente em `node_modules/resend/dist/index.d.mts`
 * depois que o `tsc` acusou os nomes da primeira tentativa como inexistentes.
 */
import type { Resend } from "resend";

export type NotificationStatus =
  "enfileirada" | "enviada" | "entregue" | "falhou" | "bounce" | "reclamada";

/** Eventos que não correspondem a um `status_notificacao` nosso retornam null. */
export function mapWebhookEventToStatus(eventType: string): NotificationStatus | null {
  switch (eventType) {
    case "email.sent":
      return "enviada";
    case "email.delivered":
      return "entregue";
    case "email.bounced":
      return "bounce";
    case "email.complained":
      return "reclamada";
    default:
      return null;
  }
}

export interface VerifyWebhookParams {
  resend: Resend;
  payload: string;
  webhookId: string;
  webhookTimestamp: string;
  webhookSignature: string;
  webhookSecret: string;
}

/**
 * Assinatura inválida joga — quem chama (a Route Handler) converte em 401. Nunca
 * processar o corpo antes de `verify` retornar com sucesso (Seção 12, integração:
 * "Webhook do Resend com assinatura inválida é rejeitado").
 */
export function verifyResendWebhook({
  resend,
  payload,
  webhookId,
  webhookTimestamp,
  webhookSignature,
  webhookSecret,
}: VerifyWebhookParams) {
  return resend.webhooks.verify({
    payload,
    headers: { id: webhookId, timestamp: webhookTimestamp, signature: webhookSignature },
    webhookSecret,
  });
}
