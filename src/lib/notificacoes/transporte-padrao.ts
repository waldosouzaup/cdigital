/**
 * Transporte de e-mail padrão da aplicação, configurado a partir do ambiente —
 * extraído porque a mesma construção se repetia em toda Server Action que dispara
 * notificação (`documentos/acoes.ts`, `pessoas/acoes.ts`, agora `contratos/acoes.ts`).
 *
 * A higienização do remetente vive em `remetente.ts` e é aplicada por
 * `createResendTransport`: aqui só resolvemos de onde vem o valor.
 */
import { createResendTransport, type EmailTransport } from "./transporte";

/** Remetente usado quando `RESEND_FROM` não está definida. Domínio verificado no Resend. */
export const REMETENTE_PADRAO = "Comitê Digital <contato@tripfriends.com.br>";

export function remetenteConfigurado(): string {
  return (process.env.RESEND_FROM || "").trim() || REMETENTE_PADRAO;
}

export function transporteEmailPadrao(): EmailTransport {
  return createResendTransport(process.env.RESEND_API_KEY ?? "", remetenteConfigurado());
}
