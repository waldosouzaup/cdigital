/**
 * Entrega o termo de distrato pelo link público de assinatura.
 *
 * Espelha `/api/contratos/publico/[token]/pdf`: a capacidade é o token de 192
 * bits, validado pela RPC antes de qualquer acesso privilegiado ao Storage.
 * Enquanto o distrato está em `distratado` devolve o termo a assinar; depois de
 * assinado, a RPC já passa a apontar para a via assinada — é o mesmo link no
 * e-mail antes e depois, sem o destinatário precisar guardar dois endereços.
 */
import { type NextRequest, NextResponse } from "next/server";
import { sha256 } from "@/lib/contratos/documento";
import { createClient } from "@/lib/supabase/server";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { nomeArquivoContrato } from "@/lib/contratos/nome-arquivo";

export const runtime = "nodejs";

interface DistratoValido {
  contrato_id: string;
  nome_completo: string;
  caminho_termo: string | null;
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
  const { data: distrato, error } = await supabase
    .rpc("validar_link_assinatura_distrato", { p_token: token })
    .maybeSingle<DistratoValido>();

  if (error || !distrato) {
    return new NextResponse("Link de assinatura inválido, expirado ou inexistente.", {
      status: 404,
    });
  }
  if (!distrato.caminho_termo) {
    return new NextResponse("O termo de distrato ainda não foi gerado.", { status: 404 });
  }

  const admin = criarClienteAdmin();
  const { data: blob, error: downloadError } = await admin.storage
    .from("contratos")
    .download(distrato.caminho_termo);

  if (downloadError || !blob) {
    return new NextResponse("Não foi possível carregar o termo de distrato.", { status: 500 });
  }

  const buffer = await blob.arrayBuffer();
  const nomeArquivo = nomeArquivoContrato(
    distrato.nome_completo,
    distrato.contrato_id,
    distrato.status === "distrato_assinado" ? "distrato_assinado" : "distrato",
  );
  const dispositionType = request.nextUrl.searchParams.has("download") ? "attachment" : "inline";

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
