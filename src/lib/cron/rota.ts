/**
 * Helpers comuns às rotas `/api/cron/*` (Fase 4).
 *
 * `service_role` (admin.ts) é permitida aqui: são jobs sem sessão de usuário,
 * exatamente o caso que a Seção 3.1 autoriza ("jobs do pg_cron e webhooks").
 * A barreira é a `CRON_SECRET` no header `Authorization: Bearer`.
 */
import { autorizarCron } from "./autorizar";

/**
 * Devolve uma resposta 401 (JSON, nunca 307 para /login — achado da Fase 2) se a
 * requisição não trouxer a `CRON_SECRET` correta. Retorna `null` quando está tudo
 * certo e a rota pode seguir.
 */
export function negarCronNaoAutorizado(request: Request): Response | null {
  if (!autorizarCron(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return Response.json({ erro: "não autorizado" }, { status: 401 });
  }
  return null;
}

/** Primeiro nome, para os e-mails (Seção 6: "nada além do primeiro nome"). */
export function primeiroNome(nomeCompleto: string | null | undefined): string {
  return (nomeCompleto ?? "").trim().split(/\s+/)[0] || "colaborador(a)";
}

export function baseUrlApp(): string {
  return process.env.APP_URL || "http://localhost:3000";
}
