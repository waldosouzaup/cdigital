/**
 * Transporte de e-mail — abstrai o Resend para que `enviar.ts` seja testável sem
 * conta real (decisão registrada em CONSULTAS.md: Resend ainda não provisionado).
 */
import { Resend } from "resend";
import { normalizarRemetente } from "./remetente";

export interface EmailTransportParams {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export type EmailTransportResult = { ok: true; id: string } | { ok: false; error: string };

export interface EmailTransport {
  send(params: EmailTransportParams): Promise<EmailTransportResult>;
}

/** Transporte real, usado em produção. Nunca chamado pelos testes desta fase. */
export function createResendTransport(apiKey: string, from: string): EmailTransport {
  if (!apiKey || !apiKey.trim()) {
    return {
      async send() {
        return { ok: false, error: "resend_api_key_ausente" };
      },
    };
  }

  // Um remetente malformado era descoberto só no retorno da API, depois que
  // `sendNotification` já tinha gravado a linha em `notificacoes` — e a chave de
  // idempotência então bloqueia o reenvio natural. Validar aqui transforma um
  // `validation_error` opaco do Resend em um motivo nomeado, antes da chamada.
  const remetente = normalizarRemetente(from);
  if (!remetente.ok) {
    const erro = `${remetente.motivo}: ${remetente.mensagem}`;
    return {
      async send() {
        return { ok: false, error: erro };
      },
    };
  }

  const resend = new Resend(apiKey);

  return {
    async send({ to, subject, html, text }) {
      try {
        const { data, error } = await resend.emails.send({
          from: remetente.valor,
          to,
          subject,
          html,
          text,
        });

        if (error || !data) {
          const detalhe = error?.message
            ? `${error.name || "erro"}: ${error.message}`
            : (error?.name ?? "erro_desconhecido");
          return { ok: false, error: detalhe };
        }

        return { ok: true, id: data.id };
      } catch (err) {
        const mensagem =
          err instanceof Error
            ? `${err.name}: ${err.message}`
            : "erro_conexao_transporte";
        return { ok: false, error: mensagem };
      }
    },
  };
}
