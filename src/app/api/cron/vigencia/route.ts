/**
 * Jobs diários de vencimento — `pg_cron` chama uma vez por dia.
 *
 * Roda dois: `vigencia_a_vencer` (contrato chegando ao fim) e
 * `documento_a_vencer` (documento com prazo, migration 0040). Ficam na mesma
 * rota porque respondem à mesma pergunta no mesmo ritmo; separá-los exigiria uma
 * segunda entrada no pg_cron e dois agendamentos que podem divergir.
 *
 * Casca fina: checa a CRON_SECRET, monta cliente admin + transporte real e
 * chama os jobs. A lógica e os testes estão em `src/lib/cron/jobs.ts`.
 */
import type { NextRequest } from "next/server";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { transporteEmailPadrao } from "@/lib/notificacoes/transporte-padrao";
import { dataEmSaoPaulo } from "@/lib/cron/agenda";
import { negarCronNaoAutorizado } from "@/lib/cron/rota";
import { jobDocumentoAVencer, jobVigenciaAVencer } from "@/lib/cron/jobs";

export async function POST(request: NextRequest) {
  const naoAutorizado = negarCronNaoAutorizado(request);
  if (naoAutorizado) return naoAutorizado;

  try {
    const deps = {
      supabase: criarClienteAdmin(),
      transport: transporteEmailPadrao(),
      hoje: dataEmSaoPaulo(),
    };
    // Sequencial: os dois compartilham transporte e a falha de um não deve
    // deixar o outro no meio do caminho.
    const contratos = await jobVigenciaAVencer(deps);
    const documentos = await jobDocumentoAVencer(deps);
    return Response.json({ ok: true, ...contratos, documentos });
  } catch {
    return Response.json({ erro: "falha no job de vigência" }, { status: 500 });
  }
}
