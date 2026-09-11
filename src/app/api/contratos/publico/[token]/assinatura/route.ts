import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { sha256 } from "@/lib/contratos/documento";
import { anexarEvidenciasPdf, validarImagemAssinatura } from "@/lib/contratos/evidencias";
import { renderizarEmailContratoAssinado } from "@/emails/contrato-assinado";
import { sendNotification } from "@/lib/notificacoes/enviar";
import { idempotencyKey } from "@/lib/notificacoes/chave-idempotencia";
import { transporteEmailPadrao } from "@/lib/notificacoes/transporte-padrao";

export const runtime = "nodejs";
const resposta = (mensagem: string, status: number) =>
  NextResponse.json({ ok: false, mensagem }, { status });

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!/^[0-9a-f]{48}$/.test(token)) return resposta("Link inválido.", 404);
  const origin = request.headers.get("origin");
  const expectedOrigin = new URL(process.env.APP_URL || request.url).origin;
  if (origin !== expectedOrigin) return resposta("Origem da solicitação inválida.", 403);
  if (Number(request.headers.get("content-length") ?? 0) > 9 * 1024 * 1024)
    return resposta("As imagens excedem o limite permitido.", 413);
  const supabase = await createClient();
  const { data: valido, error } = await supabase
    .rpc("validar_link_assinatura", { p_token: token })
    .maybeSingle<{ contrato_id: string }>();
  if (error || !valido)
    return resposta("Link inválido ou expirado. Solicite um novo link à coordenação.", 404);
  // Acesso privilegiado somente depois de validar a capacidade pública; todos os acessos são vinculados ao mesmo token/id.
  const admin = criarClienteAdmin();
  const { data: contrato } = await admin
    .from("contratos")
    .select(
      "id,pessoa_id,organizacao_id,objeto,status,caminho_pdf,pdf_sha256,assinatura_evidencias,assinado_em,pessoas(nome_completo,cpf,email)",
    )
    .eq("id", valido.contrato_id)
    .eq("token_assinatura", token)
    .single();
  if (!contrato) return resposta("Contrato não encontrado.", 404);
  if (contrato.status === "assinado")
    return NextResponse.json({ ok: true, assinadoEm: contrato.assinado_em });
  if (!contrato.caminho_pdf || !contrato.pdf_sha256)
    return resposta(
      "O contrato ainda não está pronto para assinatura. Solicite um novo link à coordenação.",
      409,
    );
  let caminho: string | null = null;
  try {
    // Limite efetivo também para requisições chunked, sem confiar em Content-Length.
    const reader = request.body?.getReader();
    if (!reader) return resposta("Envie a assinatura e a foto.", 400);
    const chunks: Uint8Array[] = [];
    let tamanho = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      tamanho += value.byteLength;
      if (tamanho > 9 * 1024 * 1024) {
        await reader.cancel();
        return resposta("As imagens excedem o limite permitido.", 413);
      }
      chunks.push(value);
    }
    const form = await new Response(Buffer.concat(chunks), {
      headers: { "content-type": request.headers.get("content-type") ?? "" },
    }).formData();
    if (form.get("consentimento") !== "true")
      return resposta(
        "Confirme que leu o contrato e autoriza o registro da assinatura e foto.",
        400,
      );
    if (form.get("documentoHash") !== contrato.pdf_sha256)
      return resposta(
        "O documento mudou. Recarregue a página e confira o contrato antes de assinar.",
        409,
      );
    const desenho = form.get("assinatura"),
      selfie = form.get("foto"),
      selfieDoc = form.get("foto_documento");
    if (!(desenho instanceof File) || !(selfie instanceof File))
      return resposta("A assinatura e a foto de identificação são obrigatórias.", 400);
    let assinatura: Buffer, foto: Buffer, fotoDocumento: Buffer | undefined;
    try {
      const validacoes: Promise<Buffer>[] = [
        validarImagemAssinatura(Buffer.from(await desenho.arrayBuffer()), "assinatura"),
        validarImagemAssinatura(Buffer.from(await selfie.arrayBuffer()), "foto"),
      ];
      if (selfieDoc instanceof File) {
        validacoes.push(
          validarImagemAssinatura(Buffer.from(await selfieDoc.arrayBuffer()), "foto"),
        );
      }
      const resultados = await Promise.all(validacoes);
      assinatura = resultados[0];
      foto = resultados[1];
      fotoDocumento = resultados[2];
    } catch (erro) {
      return resposta(erro instanceof Error ? erro.message : "Imagens inválidas.", 400);
    }
    const { data: original, error: downloadError } = await admin.storage
      .from("contratos")
      .download(contrato.caminho_pdf);
    if (downloadError || !original)
      return resposta("Não foi possível carregar o contrato. Tente novamente.", 503);
    const bytes = new Uint8Array(await original.arrayBuffer());
    if (sha256(bytes) !== contrato.pdf_sha256)
      return resposta(
        "O documento não corresponde à versão apresentada. Contate a coordenação.",
        409,
      );
    const pessoa = contrato.pessoas as unknown as {
      nome_completo: string;
      cpf: string;
      email: string | null;
    };
    const registradoEm = new Date().toISOString();
    const pdf = await anexarEvidenciasPdf({
      original: bytes,
      assinatura,
      foto,
      fotoDocumento,
      nome: pessoa.nome_completo,
      cpf: pessoa.cpf,
      contratoId: contrato.id,
      registradoEm,
    });
    caminho = `${contrato.organizacao_id}/${contrato.pessoa_id}/assinado_${contrato.id}_${randomUUID()}.pdf`;
    const { error: uploadError } = await admin.storage
      .from("contratos")
      .upload(caminho, pdf, { contentType: "application/pdf" });
    if (uploadError)
      return resposta("Não foi possível guardar o PDF assinado. Tente novamente.", 503);
    const evidencias: Record<string, unknown> = {
      consentimento: true,
      registrado_em: registradoEm,
      assinatura_sha256: sha256(assinatura),
      foto_sha256: sha256(foto),
      pdf_assinado_sha256: sha256(pdf),
      pdf_original_sha256: contrato.pdf_sha256,
      user_agent: request.headers.get("user-agent")?.slice(0, 500) ?? null,
    };
    if (fotoDocumento) {
      evidencias.foto_documento_sha256 = sha256(fotoDocumento);
    }
    const { data: salvo, error: saveError } = await admin.rpc(
      "concluir_assinatura_com_evidencias",
      {
        p_token: token,
        p_pdf_original_sha256: contrato.pdf_sha256,
        p_caminho_pdf: caminho,
        p_evidencias: evidencias,
      },
    );
    // Releitura também resolve commit com resposta perdida e envios simultâneos.
    const { data: atual, error: readError } = await admin
      .from("contratos")
      .select("caminho_pdf_assinado,status,assinado_em")
      .eq("id", contrato.id)
      .eq("token_assinatura", token)
      .single();
    if (!readError && atual?.caminho_pdf_assinado !== caminho)
      await admin.storage.from("contratos").remove([caminho]);
    if (atual?.status !== "assinado" && (saveError || !salvo))
      return resposta("O contrato mudou ou o link expirou. Recarregue a página.", 409);
    if (readError)
      return resposta(
        "Não foi possível confirmar o registro. Recarregue a página antes de tentar novamente.",
        503,
      );

    // Dispara notificação por e-mail com o link para a via do contrato assinado em PDF
    if (pessoa?.email) {
      try {
        const primeiroNome = pessoa.nome_completo.split(" ")[0];
        const dataAssinaturaFormatada = new Date(atual?.assinado_em || registradoEm).toLocaleString(
          "pt-BR",
          {
            timeZone: "America/Sao_Paulo",
            dateStyle: "short",
            timeStyle: "short",
          },
        );

        const baseUrl = process.env.APP_URL || expectedOrigin || "http://localhost:3000";
        const urlContratoAssinado = `${baseUrl}/assinar/${token}`;
        const urlDownloadPdf = `${baseUrl}/api/contratos/publico/${token}/pdf`;

        const { subject, html, text } = await renderizarEmailContratoAssinado({
          primeiroNome,
          objeto: contrato.objeto,
          dataAssinatura: dataAssinaturaFormatada,
          urlContratoAssinado,
          urlDownloadPdf,
          urlContato: baseUrl,
        });

        await sendNotification({
          supabase: admin,
          transport: transporteEmailPadrao(),
          organizationId: contrato.organizacao_id,
          type: "contrato_assinado",
          recipientEmail: pessoa.email,
          entity: "contratos",
          entityId: contrato.id,
          idempotencyKey: idempotencyKey("contrato_assinado", contrato.id),
          subject,
          html,
          text,
        });
      } catch {
        // Falha no envio de notificação não impede a conclusão da assinatura válida
      }
    }
    for (const path of [
      "/contratos",
      "/dashboard",
      "/dashboard/contratos",
      "/documentos",
      `/assinar/${token}`,
    ])
      revalidatePath(path);
    return NextResponse.json({ ok: true, assinadoEm: atual?.assinado_em });
  } catch {
    // Não apagar o arquivo em falha ambígua: a transação pode ter sido confirmada.
    return resposta("Não foi possível concluir. Confira sua conexão e tente novamente.", 500);
  }
}
