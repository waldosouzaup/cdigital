/**
 * Upload do PDF assinado — Fase 2, item 12: "Registro de assinatura por upload do
 * PDF assinado ou marcação de assinatura presencial." (a marcação sem arquivo já
 * existe em `(painel)/contratos/acoes.ts`, `marcarContratoAssinado`).
 *
 * Rota de API autenticada (não pública, ao contrário de `/api/coleta/*`): usa
 * `server.ts` normal, RLS de `contratos` decide se o coordenador pode escrever.
 * Route Handler em vez de Server Action de propósito — Server Actions do Next.js
 * têm limite padrão de 1 MB de corpo (Context 7: `serverActions.bodySizeLimit`),
 * baixo demais para um PDF escaneado; Route Handler não tem esse teto.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { obterContextoUsuario } from "@/lib/supabase/contexto-usuario";
import { registerContractWrite } from "@/lib/auditoria/registrar";

export const runtime = "nodejs";

const TAMANHO_MAXIMO_BYTES = 20 * 1024 * 1024;

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: contractId } = await params;

  const supabase = await createClient();
  const { organizationId, userId } = await obterContextoUsuario(supabase);
  if (!organizationId) {
    return NextResponse.json({ ok: false, mensagem: "Sessão inválida — faça login novamente." }, { status: 401 });
  }

  const formData = await request.formData();
  const arquivo = formData.get("arquivo");

  if (!(arquivo instanceof File)) {
    return NextResponse.json({ ok: false, mensagem: "Nenhum arquivo foi enviado." }, { status: 400 });
  }
  if (arquivo.type !== "application/pdf") {
    return NextResponse.json({ ok: false, mensagem: "Envie o contrato assinado em PDF." }, { status: 422 });
  }
  if (arquivo.size > TAMANHO_MAXIMO_BYTES) {
    return NextResponse.json({ ok: false, mensagem: "O arquivo é maior que o limite de 20 MB." }, { status: 422 });
  }

  const { data: contrato } = await supabase
    .from("contratos")
    .select("id, pessoa_id, status")
    .eq("id", contractId)
    .maybeSingle();

  if (!contrato) {
    return NextResponse.json({ ok: false, mensagem: "Contrato não encontrado." }, { status: 404 });
  }
  if (contrato.status !== "enviado") {
    return NextResponse.json(
      { ok: false, mensagem: `Só é possível anexar assinatura a um contrato "enviado" (este está "${contrato.status}").` },
      { status: 409 },
    );
  }

  const buffer = Buffer.from(await arquivo.arrayBuffer());
  const caminho = `${organizationId}/${contrato.pessoa_id}/contrato_${contractId}_assinado.pdf`;

  const { error: erroUpload } = await supabase.storage
    .from("contratos")
    .upload(caminho, buffer, { contentType: "application/pdf", upsert: true });

  if (erroUpload) {
    return NextResponse.json({ ok: false, mensagem: "Não foi possível enviar o arquivo. Tente novamente." }, { status: 500 });
  }

  await supabase.from("contratos").update({ caminho_pdf_assinado: caminho }).eq("id", contractId);

  const { error: erroTransicao } = await supabase.rpc("gravar_transicao_contrato", {
    p_contrato_id: contractId,
    p_status_anterior: "enviado",
    p_status_novo: "assinado",
    p_observacao: "Assinatura registrada via upload do PDF assinado.",
  });

  if (erroTransicao) {
    return NextResponse.json(
      { ok: false, mensagem: "PDF salvo, mas não foi possível concluir a assinatura. Tente de novo." },
      { status: 500 },
    );
  }

  await registerContractWrite({
    supabase,
    organizationId,
    userId,
    contractId,
    action: "assinatura_upload",
  });

  return NextResponse.json({ ok: true });
}
