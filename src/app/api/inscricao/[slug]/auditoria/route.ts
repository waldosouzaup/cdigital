import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extrairMetadadosAuditoria } from "@/lib/auditoria/metadados-requisicao";
import { normalizarAcaoAuditoria } from "@/lib/auditoria/acoes-publicas";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  if (!slug || typeof slug !== "string") {
    return NextResponse.json({ ok: false, erro: "Slug inválido" }, { status: 400 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    // Body vazio não impede o log de IP
  }

  // Rota pública: a ação vem do corpo da requisição, então passa por lista
  // fechada antes de virar linha em `log_auditoria`.
  const acao = normalizarAcaoAuditoria(body.acao);
  const geolocalizacao = body.geolocalizacao ?? null;
  const timestampCliente = typeof body.timestampCliente === "string" ? body.timestampCliente : null;
  const contexto =
    body.contexto && typeof body.contexto === "object" ? (body.contexto as object) : null;
  const { ip, userAgent, geoHeaders } = await extrairMetadadosAuditoria(request.headers);

  const supabase = await createClient();

  const { data, error } = await supabase.rpc("registrar_auditoria_inscricao", {
    p_slug: slug,
    p_acao: acao,
    p_ip: ip,
    p_geolocalizacao: geolocalizacao ?? null,
    p_user_agent: userAgent,
    p_detalhes: {
      timestamp_cliente: timestampCliente ?? null,
      headers_geo: geoHeaders,
      contexto_navegador: contexto,
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
