/**
 * Endpoint de consulta de CEP via ViaCEP com cache e tratamento de erros.
 * GET /api/cep/[cep]
 */
import { NextResponse, type NextRequest } from "next/server";
import { buscarEnderecoPorCep } from "@/lib/cep/viacep";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ cep: string }> },
) {
  const { cep } = await params;
  const resultado = await buscarEnderecoPorCep(cep);

  if (!resultado.sucesso) {
    return NextResponse.json(
      { ok: false, motivo: resultado.erro ?? "CEP não encontrado." },
      { status: 404 },
    );
  }

  return NextResponse.json(
    { ok: true, dados: resultado.dados },
    {
      headers: {
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
      },
    },
  );
}
