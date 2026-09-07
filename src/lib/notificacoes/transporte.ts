/**
 * Transporte de e-mail — abstrai o Resend para que `enviar.ts` seja testável sem
 * conta real (decisão registrada em CONSULTAS.md: Resend ainda não provisionado).
 */
import { Resend } from "resend";

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
  const resend = new Resend(apiKey);

  return {
    async send({ to, subject, html, text }) {
      const { data, error } = await resend.emails.send({ from, to, subject, html, text });

      if (error || !data) {
        // Regra 7: nada sensível — `error.message` do Resend não deve conter PII,
        // mas por segurança normalizamos para o nome da categoria do erro.
        return { ok: false, error: error?.name ?? "erro_desconhecido" };
      }

      return { ok: true, id: data.id };
    },
  };
}
