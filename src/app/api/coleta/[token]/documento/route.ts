/**
 * Upload de documento pelo link público de coleta — Fase 2, item 3.
 *
 * Precisa do runtime Node (não Edge): `sharp` é um módulo nativo. Validação
 * síncrona acontece toda aqui, ANTES de qualquer escrita em Storage ou banco —
 * tipo/tamanho primeiro (não custa nada), depois dimensão (lê a imagem inteira),
 * só então hash + registro. Nunca confia em nada vindo do cliente além do token da
 * própria URL — o front-end pode mostrar um preview, mas quem decide é o servidor.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  calcularHashSha256,
  extensaoPorMime,
  validarDimensaoImagem,
  validarTipoETamanho,
} from "@/lib/documentos/upload";
import { renderizarEmailDocumentoRejeitado } from "@/emails/documento-rejeitado";
import { sendNotification } from "@/lib/notificacoes/enviar";
import { idempotencyKey } from "@/lib/notificacoes/chave-idempotencia";
import { createResendTransport } from "@/lib/notificacoes/transporte";

export const runtime = "nodejs";

// Um único tipo de documento nesta primeira versão (RG/CNH/comprovante juntos) — a
// tabela `documentos.tipo` é texto livre (Seção 5 não define enum), então nada
// impede um tipo mais granular depois sem migration.
const TIPO_DOCUMENTO_PADRAO = "documento_identidade";

interface LinkColetaInfo {
  pessoa_id: string;
  organizacao_id: string;
  primeiro_nome: string;
  pessoa_email: string | null;
  organizacao_nome: string;
  expira_em: string;
}

interface RegistroDocumento {
  documento_id: string | null;
  caminho: string | null;
  duplicado: boolean;
  existente_tipo: string | null;
  existente_criado_em: string | null;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const formData = await request.formData();
  const arquivo = formData.get("arquivo");

  if (!(arquivo instanceof File)) {
    return NextResponse.json({ ok: false, motivo: "Nenhum arquivo foi enviado." }, { status: 400 });
  }

  const checagemTipo = validarTipoETamanho(arquivo.type, arquivo.size);
  if (!checagemTipo.ok) {
    return NextResponse.json({ ok: false, motivo: checagemTipo.motivo }, { status: 422 });
  }

  const supabase = await createClient();

  const { data: linkInfo, error: erroLink } = await supabase
    .rpc("validar_link_coleta", { p_token: token })
    .maybeSingle<LinkColetaInfo>();

  if (erroLink || !linkInfo) {
    return NextResponse.json(
      { ok: false, motivo: "Este link já foi usado ou expirou. Peça um novo link à coordenação." },
      { status: 410 },
    );
  }

  const buffer = Buffer.from(await arquivo.arrayBuffer());

  const checagemDimensao = await validarDimensaoImagem(buffer, arquivo.type);
  if (!checagemDimensao.ok) {
    await dispararDocumentoRejeitado({
      supabase,
      organizationId: linkInfo.organizacao_id,
      email: linkInfo.pessoa_email,
      primeiroNome: linkInfo.primeiro_nome,
      motivo: checagemDimensao.motivo!,
      token,
      pessoaId: linkInfo.pessoa_id,
      // Chave determinística pelo hash do arquivo rejeitado (Seção 6, regra 1): a
      // MESMA foto reenviada por um duplo clique/retry de rede não dispara duas
      // vezes; uma foto DIFERENTE (nova tentativa de verdade) dispara de novo.
      hashArquivoRejeitado: calcularHashSha256(buffer),
    });
    return NextResponse.json({ ok: false, motivo: checagemDimensao.motivo }, { status: 422 });
  }

  const ext = extensaoPorMime(arquivo.type);
  if (!ext) {
    // Não deveria acontecer — validarTipoETamanho já filtrou — mas sem isso o
    // TypeScript não sabe que `ext` é sempre string abaixo.
    return NextResponse.json({ ok: false, motivo: "Tipo de arquivo não suportado." }, { status: 422 });
  }

  const hash = calcularHashSha256(buffer);

  const { data: registro, error: erroRegistro } = await supabase
    .rpc("registrar_documento_coleta", {
      p_token: token,
      p_tipo: TIPO_DOCUMENTO_PADRAO,
      p_nome_original: arquivo.name,
      p_hash: hash,
      p_largura: checagemDimensao.largura ?? null,
      p_altura: checagemDimensao.altura ?? null,
      p_bytes: arquivo.size,
      p_ext: ext,
    })
    .maybeSingle<RegistroDocumento>();

  if (erroRegistro || !registro || !registro.documento_id) {
    return NextResponse.json(
      { ok: false, motivo: "Não foi possível registrar o documento. Tente novamente." },
      { status: 500 },
    );
  }

  if (registro.duplicado) {
    const dataExistente = registro.existente_criado_em
      ? new Date(registro.existente_criado_em).toLocaleDateString("pt-BR")
      : "uma data anterior";
    return NextResponse.json(
      { ok: false, motivo: `Este documento já foi enviado antes (em ${dataExistente}).` },
      { status: 409 },
    );
  }

  const { error: erroUpload } = await supabase.storage
    .from("documentos")
    .upload(registro.caminho!, buffer, { contentType: arquivo.type, upsert: false });

  if (erroUpload) {
    // Regra 7: nada de detalhe interno do erro do Storage na resposta.
    return NextResponse.json(
      { ok: false, motivo: "Não foi possível enviar o arquivo. Tente novamente." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}

async function dispararDocumentoRejeitado(params: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  organizationId: string;
  email: string | null;
  primeiroNome: string;
  motivo: string;
  token: string;
  pessoaId: string;
  hashArquivoRejeitado: string;
}) {
  // Sem e-mail cadastrado, não há para quem enviar — a mensagem já apareceu na
  // tela, o que já satisfaz "recusa com mensagem compreensível" (o gate real).
  if (!params.email) return;

  const baseUrl = process.env.APP_URL || "http://localhost:3000";
  const { subject, html, text } = await renderizarEmailDocumentoRejeitado({
    primeiroNome: params.primeiroNome,
    motivo: params.motivo,
    urlReenvio: `${baseUrl}/coleta/${params.token}`,
  });

  const transporte = createResendTransport(
    process.env.RESEND_API_KEY ?? "",
    process.env.RESEND_FROM ?? "Comitê Digital <nao-responda@exemplo.invalid>",
  );

  await sendNotification({
    supabase: params.supabase,
    transport: transporte,
    organizationId: params.organizationId,
    type: "documento_rejeitado",
    recipientEmail: params.email,
    entity: "pessoas",
    entityId: params.pessoaId,
    idempotencyKey: idempotencyKey(
      "documento_rejeitado",
      params.pessoaId,
      params.hashArquivoRejeitado,
    ),
    subject,
    html,
    text,
  });
}
