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
  if (!apiKey || !apiKey.trim()) {
    return {
      async send() {
        return { ok: false, error: "resend_api_key_ausente" };
      },
    };
  }

  // Remove aspas envolventes caso o ambiente preserve aspas literais
  const remetenteLimpo = from.trim().replace(/^["']|["']$/g, "").trim();
  if (!remetenteLimpo) {
    return {
      async send() {
        return { ok: false, error: "resend_from_ausente" };
      },
    };
  }

  const resend = new Resend(apiKey);

  return {
    async send({ to, subject, html, text }) {
      try {
        const { data, error } = await resend.emails.send({
          from: remetenteLimpo,
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
