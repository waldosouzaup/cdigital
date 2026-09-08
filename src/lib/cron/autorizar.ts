/**
 * Autorização das rotas de cron — Fase 4, item 5.
 *
 * As rotas `/api/cron/*` são chamadas pelo `pg_cron` (via `pg_net.http_post`), sem
 * sessão de usuário. A única barreira é a `CRON_SECRET`, enviada como
 * `Authorization: Bearer <segredo>`. Segue o mesmo princípio do webhook do Resend:
 * nenhuma rota `/api/*` redireciona para `/login` (achado da Fase 2) — cada uma faz
 * sua própria checagem e devolve JSON com o status certo (401 aqui).
 *
 * Comparação em tempo constante (`timingSafeEqual`) para não vazar o segredo por
 * análise de tempo de resposta. Nega em qualquer dúvida: segredo não configurado,
 * cabeçalho ausente, formato inesperado ou comprimento diferente.
 */
import { timingSafeEqual } from "node:crypto";

const PREFIXO = "Bearer ";

export function autorizarCron(
  cabecalhoAutorizacao: string | null | undefined,
  segredoEsperado: string | undefined,
): boolean {
  if (!segredoEsperado) return false;
  if (!cabecalhoAutorizacao || !cabecalhoAutorizacao.startsWith(PREFIXO)) return false;

  const token = Buffer.from(cabecalhoAutorizacao.slice(PREFIXO.length));
  const esperado = Buffer.from(segredoEsperado);

  if (token.length !== esperado.length) return false;
  return timingSafeEqual(token, esperado);
}
