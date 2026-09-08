/**
 * Job de reprocessamento de notificações `falhou` (Fase 4, item 4; Seção 6,
 * regra 4). `pg_cron` chama a cada 15 minutos. Reenvia usando o `payload_reenvio`
 * guardado na linha; para em `tentativas >= 3` (a notificação então aparece na
 * central de pendências do painel).
 */
import type { NextRequest } from "next/server";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { transporteEmailPadrao } from "@/lib/notificacoes/transporte-padrao";
import { reprocessarNotificacoesFalhas } from "@/lib/notificacoes/reprocessar";
import { negarCronNaoAutorizado } from "@/lib/cron/rota";

const MAX_TENTATIVAS = 3;

export async function POST(request: NextRequest) {
  const naoAutorizado = negarCronNaoAutorizado(request);
  if (naoAutorizado) return naoAutorizado;

  const supabase = criarClienteAdmin();
  const transport = transporteEmailPadrao();

  try {
    const resultado = await reprocessarNotificacoesFalhas({
      supabase,
      transport,
      maxTentativas: MAX_TENTATIVAS,
    });
    return Response.json({ ok: true, ...resultado });
  } catch {
    return Response.json({ erro: "falha ao reprocessar notificações" }, { status: 500 });
  }
}
