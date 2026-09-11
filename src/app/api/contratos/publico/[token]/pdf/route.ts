import { PDFDocument } from "pdf-lib";
import { sha256 } from "@/lib/contratos/documento";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { nomeArquivoContrato } from "@/lib/contratos/nome-arquivo";

export const runtime = "nodejs";

interface ContratoValido {
  contrato_id: string;
  pessoa_id: string;
  nome_completo: string;
  caminho_pdf: string | null;
  status: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!/^[0-9a-f]{48}$/.test(token)) {
    return new NextResponse("Token não informado.", { status: 400 });
  }

  const supabase = await createClient();
  const { data: contrato, error } = await supabase
    .rpc("validar_link_assinatura", { p_token: token })
    .maybeSingle<ContratoValido>();

  if (error || !contrato) {
    return new NextResponse("Link de assinatura inválido, expirado ou inexistente.", {
      status: 404,
    });
  }
  if (!contrato.caminho_pdf) {
    return new NextResponse("O arquivo PDF deste contrato ainda não foi gerado.", { status: 404 });
  }

  const adminClient = criarClienteAdmin();
  const { data: blob, error: downloadError } = await adminClient.storage
    .from("contratos")
    .download(contrato.caminho_pdf);

  if (downloadError || !blob) {
    return new NextResponse("Não foi possível carregar o arquivo PDF do contrato.", {
      status: 500,
    });
  }

  const buffer = await blob.arrayBuffer();

  if (request.nextUrl.searchParams.get("formato") === "leitura") {
    const pdf = await PDFDocument.load(buffer);
    return NextResponse.json(
      { texto: pdf.getSubject() ?? null, hash: sha256(new Uint8Array(buffer)) },
      {
        headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" },
      },
    );
  }
  const nomeArquivo = nomeArquivoContrato(contrato.nome_completo, contrato.contrato_id);
  const querDownload = request.nextUrl.searchParams.has("download");
  const dispositionType = querDownload ? "attachment" : "inline";

  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "X-Documento-SHA256": sha256(new Uint8Array(buffer)),
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Content-Disposition": `${dispositionType}; filename="${nomeArquivo}"; filename*=UTF-8''${encodeURIComponent(nomeArquivo)}`,
      "Cache-Control": "private, no-cache, no-store, must-revalidate",
    },
  });
}
