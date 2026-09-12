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
  /**
   * Ignora o teto de tentativas e zera o contador das linhas reenviadas.
   *
   * Existe para o caso em que a falha nunca foi da mensagem e sim da
   * configuração: 21 notificações queimaram as três tentativas contra um
   * `RESEND_FROM` malformado e ficaram fora do alcance do filtro abaixo mesmo
   * depois de o remetente ser corrigido. Fica atrás de uma ação explícita do
   * administrador — no automático, o teto continua valendo.
   */
  reiniciarTentativas?: boolean;
}

export interface ReprocessarResultado {
  processadas: number;
  reenviadas: number;
  aindaFalhando: number;
}

export async function reprocessarNotificacoesFalhas(
  params: ReprocessarParams,
): Promise<ReprocessarResultado> {
  const { supabase, transport, maxTentativas, reiniciarTentativas = false } = params;

  const consulta = supabase
    .from("notificacoes")
    .select("id, destinatario_email, tentativas, payload_reenvio")
    .eq("status", "falhou")
    .not("payload_reenvio", "is", null);

  const { data, error } = await (reiniciarTentativas
    ? consulta
    : consulta.lt("tentativas", maxTentativas));

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
    // Reiniciar significa tratar este envio como a primeira tentativa da
    // configuração nova — senão a linha voltaria a nascer estourada.
    const tentativas = reiniciarTentativas ? 1 : linha.tentativas + 1;
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
