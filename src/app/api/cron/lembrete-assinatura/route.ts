/**
 * Job `lembrete_assinatura` (Fase 4, item 4) — `pg_cron` chama uma vez por dia.
 * Casca fina; lógica em `src/lib/cron/jobs.ts`.
 */
import type { NextRequest } from "next/server";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { transporteEmailPadrao } from "@/lib/notificacoes/transporte-padrao";
import { dataEmSaoPaulo } from "@/lib/cron/agenda";
import { negarCronNaoAutorizado } from "@/lib/cron/rota";
import { jobLembreteAssinatura } from "@/lib/cron/jobs";

export async function POST(request: NextRequest) {
  const naoAutorizado = negarCronNaoAutorizado(request);
  if (naoAutorizado) return naoAutorizado;

  try {
    const resultado = await jobLembreteAssinatura({
      supabase: criarClienteAdmin(),
      transport: transporteEmailPadrao(),
      hoje: dataEmSaoPaulo(),
    });
    return Response.json({ ok: true, ...resultado });
  } catch {
    return Response.json({ erro: "falha no job de lembrete" }, { status: 500 });
  }
}
