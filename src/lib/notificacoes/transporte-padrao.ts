/**
 * Transporte de e-mail padrão da aplicação, configurado a partir do ambiente —
 * extraído porque a mesma construção se repetia em toda Server Action que dispara
 * notificação (`documentos/acoes.ts`, `pessoas/acoes.ts`, agora `contratos/acoes.ts`).
 */
import { createResendTransport, type EmailTransport } from "./transporte";

export function transporteEmailPadrao(): EmailTransport {
  const apiKey = process.env.RESEND_API_KEY ?? "";
  const from =
    (process.env.RESEND_FROM || "").trim() ||
    "Comitê Digital <contato@tripfriends.com.br>";

  return createResendTransport(apiKey, from);
}
