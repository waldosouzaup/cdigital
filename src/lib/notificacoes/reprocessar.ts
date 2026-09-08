/**
 * Reprocessamento de notificações que ficaram em `falhou` — Fase 4, item 4 e
 * Seção 6, regra 4 ("um job tenta de novo, no máximo 3 tentativas").
 *
 * Genérico por tipo: o `payload_reenvio` (subject/html/text) foi persistido na
 * própria linha por `sendNotification`, então o retry não depende de re-renderizar
 * nenhum template. Chamado pela rota `/api/cron/reprocessar-notificacoes`.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { EmailTransport } from "./transporte";

interface PayloadReenvio {
  subject: string;
  html: string;
  text: string;
}

export interface ReprocessarParams {
  supabase: SupabaseClient;
  transport: EmailTransport;
  maxTentativas: number;
}

export interface ReprocessarResultado {
  processadas: number;
  reenviadas: number;
  aindaFalhando: number;
}

export async function reprocessarNotificacoesFalhas(
  params: ReprocessarParams,
): Promise<ReprocessarResultado> {
  const { supabase, transport, maxTentativas } = params;

  const { data, error } = await supabase
    .from("notificacoes")
    .select("id, destinatario_email, tentativas, payload_reenvio")
    .eq("status", "falhou")
    .lt("tentativas", maxTentativas)
    .not("payload_reenvio", "is", null);

  if (error) throw new Error("Não foi possível listar as notificações a reprocessar.");

  const linhas = (data ?? []) as Array<{
    id: string;
    destinatario_email: string;
    tentativas: number;
    payload_reenvio: PayloadReenvio;
  }>;

  let reenviadas = 0;
  let aindaFalhando = 0;

  for (const linha of linhas) {
    const tentativas = linha.tentativas + 1;
    const resultado = await transport.send({
      to: linha.destinatario_email,
      subject: linha.payload_reenvio.subject,
      html: linha.payload_reenvio.html,
      text: linha.payload_reenvio.text,
    });

    if (resultado.ok) {
      reenviadas += 1;
      await supabase
        .from("notificacoes")
        .update({
          status: "enviada",
          resend_id: resultado.id,
          enviada_em: new Date().toISOString(),
          tentativas,
        })
        .eq("id", linha.id);
    } else {
      aindaFalhando += 1;
      await supabase
        .from("notificacoes")
        .update({ status: "falhou", erro: resultado.error, tentativas })
        .eq("id", linha.id);
    }
  }

  return { processadas: linhas.length, reenviadas, aindaFalhando };
}
