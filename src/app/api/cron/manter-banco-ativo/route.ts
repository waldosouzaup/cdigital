/**
 * Job `manter_banco_ativo` — `pg_cron` chama uma vez por dia, de madrugada
 * (ver `src/lib/cron/agenda.ts` e a migration 0033). Casca fina, igual às
 * outras rotas de `/api/cron/*`; a lógica (um único ping barato ao banco)
 * está em `src/lib/cron/jobs.ts`.
 *
 * Único propósito: gerar uma chamada externa diária à API do Supabase, para
 * o projeto nunca ser pausado por inatividade — independente de qualquer job
 * de negócio ter encontrado algo para fazer no dia.
 */
import type { NextRequest } from "next/server";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { negarCronNaoAutorizado } from "@/lib/cron/rota";
import { jobManterBancoAtivo } from "@/lib/cron/jobs";

export async function POST(request: NextRequest) {
  const naoAutorizado = negarCronNaoAutorizado(request);
  if (naoAutorizado) return naoAutorizado;

  try {
    const resultado = await jobManterBancoAtivo({ supabase: criarClienteAdmin() });
    return Response.json(resultado);
  } catch {
    return Response.json({ erro: "falha no job de manter o banco ativo" }, { status: 500 });
  }
}
