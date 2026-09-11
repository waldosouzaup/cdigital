import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extrairMetadadosAuditoria } from "@/lib/auditoria/metadados-requisicao";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  if (!token || typeof token !== "string" || token.length < 10) {
    return NextResponse.json({ ok: false, erro: "Token inválido" }, { status: 400 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    // Body vazio ou inválido não impede o log de IP
  }

  const acao = typeof body.acao === "string" ? body.acao : "inicio_preenchimento";
  const geolocalizacao = body.geolocalizacao ?? null;
  const timestampCliente = typeof body.timestampCliente === "string" ? body.timestampCliente : null;
  const { ip, userAgent, geoHeaders } = await extrairMetadadosAuditoria(request.headers);

  const supabase = await createClient();

  const { data, error } = await supabase.rpc("registrar_auditoria_coleta", {
    p_token: token,
    p_acao: acao,
    p_ip: ip,
    p_geolocalizacao: geolocalizacao ?? null,
    p_user_agent: userAgent,
    p_detalhes: {
      timestamp_cliente: timestampCliente ?? null,
      headers_geo: geoHeaders,
    },
  });

  if (error || !data) {
    return NextResponse.json(
      { ok: false, erro: "Não foi possível registrar auditoria" },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true });
}
