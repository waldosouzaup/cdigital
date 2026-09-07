/**
 * Webhook de entrega do Resend — Seção 6, regra 5.
 *
 * `service_role` é permitida aqui porque não há sessão de usuário nenhuma
 * (Seção 3.1: "service_role só é permitida em: seed, migrations, jobs do pg_cron e
 * webhooks"). Assinatura verificada antes de qualquer leitura do corpo.
 */
import { Resend } from "resend";
import type { NextRequest } from "next/server";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { mapWebhookEventToStatus, verifyResendWebhook } from "@/lib/notificacoes/webhook";

export async function POST(request: NextRequest) {
  const payload = await request.text();

  let event: Awaited<ReturnType<typeof verifyResendWebhook>>;
  try {
    event = verifyResendWebhook({
      resend: new Resend(process.env.RESEND_API_KEY!),
      payload,
      webhookId: request.headers.get("webhook-id") ?? "",
      webhookTimestamp: request.headers.get("webhook-timestamp") ?? "",
      webhookSignature: request.headers.get("webhook-signature") ?? "",
      webhookSecret: process.env.RESEND_WEBHOOK_SECRET!,
    });
  } catch {
    // Regra 7: não logar o payload nem os headers — podem conter o e-mail do
    // destinatário.
    return Response.json({ error: "assinatura inválida" }, { status: 401 });
  }

  const status = mapWebhookEventToStatus(event.type);
  if (!status) {
    // Evento que não corresponde a um status_notificacao nosso (ex.: email.opened) —
    // confirma recebimento sem atualizar nada.
    return Response.json({ recebido: true });
  }

  // Todo evento com status mapeado (sent/delivered/bounced/complained) estende
  // BaseEmailEventData, que sempre tem email_id — só os eventos de contact/domain/
  // suppression (já descartados acima, pois mapWebhookEventToStatus retorna null
  // para eles) têm um formato de `data` diferente.
  const emailId = (event.data as { email_id: string }).email_id;

  const supabase = criarClienteAdmin();
  const { error } = await supabase.from("notificacoes").update({ status }).eq("resend_id", emailId);

  if (error) {
    return Response.json({ error: "falha ao atualizar notificação" }, { status: 500 });
  }

  return Response.json({ recebido: true });
}
