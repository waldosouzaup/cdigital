/**
 * Job `resumo_diario` (Fase 4, item 4) — `pg_cron` chama às 11:00 UTC = 08:00
 * America/Sao_Paulo, seg-sex. Casca fina; lógica (incl. guarda de dia útil) em
 * `src/lib/cron/jobs.ts`.
 */
import type { NextRequest } from "next/server";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { transporteEmailPadrao } from "@/lib/notificacoes/transporte-padrao";
import { negarCronNaoAutorizado } from "@/lib/cron/rota";
import { jobResumoDiario } from "@/lib/cron/jobs";

export async function POST(request: NextRequest) {
  const naoAutorizado = negarCronNaoAutorizado(request);
  if (naoAutorizado) return naoAutorizado;

  try {
    const resultado = await jobResumoDiario({
      supabase: criarClienteAdmin(),
      transport: transporteEmailPadrao(),
      agora: new Date(),
    });
    return Response.json({ ok: true, ...resultado });
  } catch {
    return Response.json({ erro: "falha no job de resumo diário" }, { status: 500 });
  }
}
