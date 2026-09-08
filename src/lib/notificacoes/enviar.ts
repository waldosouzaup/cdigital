/**
 * Envio de notificação — Seção 6, regras 1 e 3 do PROMPT-Comite-Digital.md.
 *
 * Ordem invariável: insere a linha em `notificacoes` (o índice único de
 * `chave_idempotencia` é quem garante que o mesmo aviso nunca sai duas vezes) e só
 * então chama o transporte de e-mail. Falha do transporte nunca lança — vira
 * `status: 'falhou'` na própria linha, e quem chamou (a transação de negócio) já
 * commitou antes disso, então o contrato continua no estado que ficou.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { NotificationType } from "./chave-idempotencia";
import type { EmailTransport } from "./transporte";

const CODIGO_VIOLACAO_UNIQUE = "23505";

export interface SendNotificationParams {
  supabase: SupabaseClient;
  transport: EmailTransport;
  organizationId: string;
  type: NotificationType;
  recipientEmail: string;
  entity: string;
  entityId: string;
  idempotencyKey: string;
  subject: string;
  html: string;
  text: string;
}

export type SendNotificationResult =
  { sent: true } | { sent: false; reason: "duplicate" | "failed" };

export async function sendNotification(
  params: SendNotificationParams,
): Promise<SendNotificationResult> {
  const { supabase, transport } = params;

  const { data: inserted, error: insertError } = await supabase
    .from("notificacoes")
    .insert({
      organizacao_id: params.organizationId,
      tipo: params.type,
      destinatario_email: params.recipientEmail,
      entidade: params.entity,
      entidade_id: params.entityId,
      chave_idempotencia: params.idempotencyKey,
      status: "enfileirada",
      // Guardado para o job de reprocessamento (Fase 4, item 4) reenviar sem
      // re-renderizar o template por tipo. Os templates não carregam PII
      // (Seção 6, regra 7), então é seguro persistir aqui.
      payload_reenvio: { subject: params.subject, html: params.html, text: params.text },
    })
    .select("id")
    .single();

  if (insertError) {
    if (insertError.code === CODIGO_VIOLACAO_UNIQUE) {
      // "tente inserir; se o índice único recusar, não envie" (Seção 6, regra 1).
      return { sent: false, reason: "duplicate" };
    }
    // Regra 7: nada sensível na mensagem — não repassar insertError.message aqui.
    throw new Error("Não foi possível registrar a notificação antes do envio.");
  }

  const notificationId = inserted!.id;
  const result = await transport.send({
    to: params.recipientEmail,
    subject: params.subject,
    html: params.html,
    text: params.text,
  });

  if (!result.ok) {
    await supabase
      .from("notificacoes")
      .update({ status: "falhou", erro: result.error, tentativas: 1 })
      .eq("id", notificationId);
    return { sent: false, reason: "failed" };
  }

  await supabase
    .from("notificacoes")
    .update({ status: "enviada", resend_id: result.id, enviada_em: new Date().toISOString() })
    .eq("id", notificationId);

  return { sent: true };
}
