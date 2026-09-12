/**
 * Assinatura eletrônica do termo de distrato.
 *
 * Espelha `/api/contratos/publico/[token]/assinatura` trava por trava — mesma
 * checagem de origem, mesmo teto de upload aplicado por leitura em vez de
 * confiar no Content-Length, mesma conferência de SHA-256 contra o documento que
 * a pessoa leu na tela, mesma conclusão atômica por RPC.
 *
 * O que muda é o alvo: a capacidade é `token_assinatura_distrato`, a transição
 * é `distratado → distrato_assinado`, e o aviso de saída leva o link da via
 * assinada.
 */
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { sha256 } from "@/lib/contratos/documento";
import { anexarEvidenciasPdf, validarImagemAssinatura } from "@/lib/contratos/evidencias";
import { renderizarEmailDistratoAssinado } from "@/emails/distrato-assinado";
import { sendNotification } from "@/lib/notificacoes/enviar";
import { idempotencyKey } from "@/lib/notificacoes/chave-idempotencia";
import { transporteEmailPadrao } from "@/lib/notificacoes/transporte-padrao";
import { calcularProporcionalDistrato } from "@/lib/contratos/distrato";

export const runtime = "nodejs";

const TETO_UPLOAD = 9 * 1024 * 1024;

const resposta = (mensagem: string, status: number) =>
  NextResponse.json({ ok: false, mensagem }, { status });

function formatarValorBRL(valor: number): string {
  return `R$ ${valor.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!/^[0-9a-f]{48}$/.test(token)) return resposta("Link inválido.", 404);

  const origin = request.headers.get("origin");
  const expectedOrigin = new URL(process.env.APP_URL || request.url).origin;
  if (origin !== expectedOrigin) return resposta("Origem da solicitação inválida.", 403);
  if (Number(request.headers.get("content-length") ?? 0) > TETO_UPLOAD)
    return resposta("As imagens excedem o limite permitido.", 413);

  const supabase = await createClient();
  const { data: valido, error } = await supabase
    .rpc("validar_link_assinatura_distrato", { p_token: token })
    .maybeSingle<{ contrato_id: string }>();
  if (error || !valido)
    return resposta("Link inválido ou expirado. Solicite um novo link à coordenação.", 404);

  // Acesso privilegiado só depois de validada a capacidade pública.
  const admin = criarClienteAdmin();
  const { data: contrato } = await admin
    .from("contratos")
    // Literal de propósito: o cliente tipado do Supabase só infere as colunas a
    // partir de uma string literal — concatenar aqui devolve `GenericStringError`.
    .select(
      "id,pessoa_id,organizacao_id,objeto,valor,status,vigencia_inicio,vigencia_fim,caminho_termo_distrato,termo_distrato_sha256,distrato_assinado_em,pessoas(nome_completo,cpf,email)",
    )
    .eq("id", valido.contrato_id)
    .eq("token_assinatura_distrato", token)
    .single();

  if (!contrato) return resposta("Distrato não encontrado.", 404);
  if (contrato.status === "distrato_assinado")
    return NextResponse.json({ ok: true, assinadoEm: contrato.distrato_assinado_em });
  if (!contrato.caminho_termo_distrato || !contrato.termo_distrato_sha256)
    return resposta(
      "O termo de distrato ainda não está pronto para assinatura. Fale com a coordenação.",
      409,
    );

  let caminho: string | null = null;
  try {
    // Teto aplicado durante a leitura: requisição chunked não declara tamanho.
    const reader = request.body?.getReader();
    if (!reader) return resposta("Envie a assinatura e a foto.", 400);
    const chunks: Uint8Array[] = [];
    let tamanho = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      tamanho += value.byteLength;
      if (tamanho > TETO_UPLOAD) {
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
        "Confirme que leu o termo e autoriza o registro da assinatura e foto.",
        400,
      );
    if (form.get("documentoHash") !== contrato.termo_distrato_sha256)
      return resposta(
        "O termo mudou. Recarregue a página e confira o documento antes de assinar.",
        409,
      );

    const desenho = form.get("assinatura");
    const selfie = form.get("foto");
    if (!(desenho instanceof File) || !(selfie instanceof File))
      return resposta("A assinatura e a foto de identificação são obrigatórias.", 400);

    let assinatura: Buffer;
    let foto: Buffer;
    try {
      [assinatura, foto] = await Promise.all([
        validarImagemAssinatura(Buffer.from(await desenho.arrayBuffer()), "assinatura"),
        validarImagemAssinatura(Buffer.from(await selfie.arrayBuffer()), "foto"),
      ]);
    } catch (erro) {
      return resposta(erro instanceof Error ? erro.message : "Imagens inválidas.", 400);
    }

    const { data: original, error: downloadError } = await admin.storage
      .from("contratos")
      .download(contrato.caminho_termo_distrato);
    if (downloadError || !original)
      return resposta("Não foi possível carregar o termo. Tente novamente.", 503);

    const bytes = new Uint8Array(await original.arrayBuffer());
    if (sha256(bytes) !== contrato.termo_distrato_sha256)
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
      nome: pessoa.nome_completo,
      cpf: pessoa.cpf,
      contratoId: contrato.id,
      registradoEm,
    });

    caminho = `${contrato.organizacao_id}/${contrato.pessoa_id}/distrato_assinado_${contrato.id}_${randomUUID()}.pdf`;
    const { error: uploadError } = await admin.storage
      .from("contratos")
      .upload(caminho, pdf, { contentType: "application/pdf" });
    if (uploadError)
      return resposta("Não foi possível guardar o termo assinado. Tente novamente.", 503);

    const evidencias: Record<string, unknown> = {
      consentimento: true,
      registrado_em: registradoEm,
      assinatura_sha256: sha256(assinatura),
      foto_sha256: sha256(foto),
      pdf_assinado_sha256: sha256(pdf),
      termo_original_sha256: contrato.termo_distrato_sha256,
      user_agent: request.headers.get("user-agent")?.slice(0, 500) ?? null,
    };

    const { data: salvo, error: saveError } = await admin.rpc(
      "concluir_assinatura_distrato_com_evidencias",
      {
        p_token: token,
        p_termo_sha256: contrato.termo_distrato_sha256,
        p_caminho_pdf: caminho,
        p_evidencias: evidencias,
      },
    );

    // Releitura resolve commit com resposta perdida e envios simultâneos.
    const { data: atual, error: readError } = await admin
      .from("contratos")
      .select("caminho_termo_distrato_assinado,status,distrato_assinado_em")
      .eq("id", contrato.id)
      .eq("token_assinatura_distrato", token)
      .single();

    if (!readError && atual?.caminho_termo_distrato_assinado !== caminho)
      await admin.storage.from("contratos").remove([caminho]);
    if (atual?.status !== "distrato_assinado" && (saveError || !salvo))
      return resposta("O distrato mudou ou o link expirou. Recarregue a página.", 409);
    if (readError)
      return resposta(
        "Não foi possível confirmar o registro. Recarregue a página antes de tentar novamente.",
        503,
      );

    if (pessoa?.email) {
      try {
        const assinadoEm = atual?.distrato_assinado_em || registradoEm;
        const calculo = calcularProporcionalDistrato({
          vigenciaInicio: contrato.vigencia_inicio,
          vigenciaFim: contrato.vigencia_fim,
          dataDistrato: assinadoEm.split("T")[0],
          valor: Number(contrato.valor),
        });
        const baseUrl = process.env.APP_URL || expectedOrigin || "http://localhost:3000";

        const { subject, html, text } = await renderizarEmailDistratoAssinado({
          primeiroNome: pessoa.nome_completo.split(" ")[0],
          objeto: contrato.objeto,
          dataAssinatura: new Date(assinadoEm).toLocaleString("pt-BR", {
            timeZone: "America/Sao_Paulo",
            dateStyle: "short",
            timeStyle: "short",
          }),
          periodoTrabalhado: `${calculo.vigenciaInicioFormatada} a ${calculo.dataDistratoFormatada} (${calculo.diasTrabalhados}/${calculo.diasTotais} dias)`,
          valorProporcional: formatarValorBRL(calculo.valorProporcional),
          urlTermoAssinado: `${baseUrl}/assinar-distrato/${token}`,
          urlDownloadPdf: `${baseUrl}/api/distratos/publico/${token}/pdf?download=1`,
          urlContato: baseUrl,
        });

        await sendNotification({
          supabase: admin,
          transport: transporteEmailPadrao(),
          organizationId: contrato.organizacao_id,
          type: "distrato_assinado",
          recipientEmail: pessoa.email,
          entity: "contratos",
          entityId: contrato.id,
          idempotencyKey: idempotencyKey("distrato_assinado", contrato.id),
          subject,
          html,
          text,
        });
      } catch {
        // Falha de notificação não invalida uma assinatura já registrada.
      }
    }

    for (const path of [
      "/contratos",
      "/dashboard",
      "/dashboard/contratos",
      `/assinar-distrato/${token}`,
    ])
      revalidatePath(path);

    return NextResponse.json({ ok: true, assinadoEm: atual?.distrato_assinado_em });
  } catch {
    // Não apagar o arquivo em falha ambígua: a transação pode ter sido confirmada.
    return resposta("Não foi possível concluir. Confira sua conexão e tente novamente.", 500);
  }
}
