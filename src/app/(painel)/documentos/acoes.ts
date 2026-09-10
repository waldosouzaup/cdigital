/**
 * Server Actions da mesa de triagem — Fase 2, item 6: "Documentação completa e
 * aprovada marca a pessoa como apta e dispara pessoa_apta." Toda decisão de
 * aptidão passa por `pessoaEstaApta` (função pura testada), nunca é recalculada
 * inline aqui.
 */
"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { obterContextoUsuario } from "@/lib/supabase/contexto-usuario";
import { randomBytes } from "node:crypto";
import {
  registerDocumentReview,
  registerPersonWrite,
  registerContractWrite,
} from "@/lib/auditoria/registrar";
import { pessoaEstaApta } from "@/lib/pessoas/aptidao";
import { criarUrlAssinada } from "@/lib/documentos/url-assinada";
import { gerarTokenColeta } from "@/lib/coleta/token";
import { renderizarEmailPessoaApta } from "@/emails/pessoa-apta";
import { renderizarEmailDocumentoRejeitado } from "@/emails/documento-rejeitado";
import { renderizarEmailContratoEnviado } from "@/emails/contrato-enviado";
import { sendNotification } from "@/lib/notificacoes/enviar";
import { idempotencyKey } from "@/lib/notificacoes/chave-idempotencia";
import { transporteEmailPadrao } from "@/lib/notificacoes/transporte-padrao";
import { substituirMarcadores } from "@/lib/contratos/marcadores";
import { gerarPdfContrato, htmlParaTexto } from "@/lib/contratos/gerar-pdf";
import { amountInWords } from "@/lib/contratos/valor-extenso";

export interface ResultadoAcaoDocumento {
  ok: boolean;
  mensagem?: string;
  pessoaFicouApta?: boolean;
  contratoId?: string;
  tokenAssinatura?: string;
  urlAssinatura?: string;
  emailEnviado?: boolean;
  destinatarioEmail?: string | null;
  pessoaNome?: string;
}

// Trava de papel (migration 0016): aprovar/rejeitar documento é exclusivo de gestor
// e coord_comite. As policies `documentos_*` já barram os demais; a checagem aqui
// devolve mensagem clara em vez de erro genérico de RLS.
const PAPEIS_TRIAGEM = ["gestor", "coord_comite"];
const RECUSA_PAPEL = "Só gestores ou coordenadores de comitê podem validar documentos.";

function formatarValorBRL(valor: number): string {
  return `R$ ${valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatarDataBR(isoDate: string): string {
  const [ano, mes, dia] = isoDate.split("-");
  return `${dia}/${mes}/${ano}`;
}

export async function aprovarDocumentoEGerarContrato(
  documentoId: string,
): Promise<ResultadoAcaoDocumento> {
  const supabase = await createClient();
  const { organizationId, userId, papel } = await obterContextoUsuario(supabase);
  if (!organizationId) return { ok: false, mensagem: "Sessão inválida — faça login novamente." };
  if (!PAPEIS_TRIAGEM.includes(papel ?? "")) return { ok: false, mensagem: RECUSA_PAPEL };

  // 1. Aprova o documento
  const { data: documento, error: erroDoc } = await supabase
    .from("documentos")
    .update({ status: "aprovado", motivo_rejeicao: null })
    .eq("id", documentoId)
    .select("id, pessoa_id")
    .single();

  if (erroDoc || !documento) {
    return { ok: false, mensagem: "Não foi possível aprovar o documento." };
  }

  await registerDocumentReview({
    supabase,
    organizationId,
    userId,
    documentId: documento.id,
    action: "aprovacao",
  });

  // 2. Reavalia aptidão
  const pessoaFicouApta = await reavaliarAptidao({
    supabase,
    organizationId,
    userId,
    pessoaId: documento.pessoa_id,
  });

  // 3. Busca dados cadastrais completos da pessoa
  const { data: pessoa } = await supabase
    .from("pessoas")
    .select("id, nome_completo, cpf, endereco, chave_pix, funcao, email, regiao_id")
    .eq("id", documento.pessoa_id)
    .single();

  if (!pessoa) {
    revalidatePath("/documentos");
    return { ok: true, pessoaFicouApta, mensagem: "Documento aprovado." };
  }

  // 4. Seleciona o modelo de contrato correspondente à função ou template ativo padrão
  const { data: templates } = await supabase
    .from("templates_contrato")
    .select("id, nome, objeto, corpo_html, valor_padrao")
    .eq("organizacao_id", organizationId)
    .eq("ativo", true);

  let templateEscolhido = templates?.find((t) => {
    if (!pessoa.funcao) return false;
    const funcLower = pessoa.funcao.toLowerCase().trim();
    return (
      t.objeto.toLowerCase().trim() === funcLower ||
      t.nome.toLowerCase().includes(funcLower)
    );
  });

  if (!templateEscolhido && templates && templates.length > 0) {
    templateEscolhido = templates[0];
  }

  if (!templateEscolhido) {
    revalidatePath("/documentos");
    revalidatePath("/pessoas");
    return {
      ok: true,
      pessoaFicouApta,
      pessoaNome: pessoa.nome_completo,
      mensagem: "Documento aprovado com sucesso. Nenhum modelo de contrato ativo encontrado.",
    };
  }

  // 5. Configura vigência, remuneração e token exclusivo
  const valor =
    templateEscolhido.valor_padrao && Number(templateEscolhido.valor_padrao) > 0
      ? Number(templateEscolhido.valor_padrao)
      : 3553;
  const valorExtenso = amountInWords(valor);
  const vigenciaInicio = "2026-09-01";
  const vigenciaFim = "2026-10-03";
  const tokenAssinatura = randomBytes(24).toString("hex");

  // 6. Insere o contrato em rascunho com o token_assinatura
  const { data: contrato, error: erroInsercaoContrato } = await supabase
    .from("contratos")
    .insert({
      organizacao_id: organizationId,
      pessoa_id: pessoa.id,
      template_id: templateEscolhido.id,
      objeto: templateEscolhido.objeto,
      valor,
      valor_extenso: valorExtenso,
      vigencia_inicio: vigenciaInicio,
      vigencia_fim: vigenciaFim,
      token_assinatura: tokenAssinatura,
      regiao_id: pessoa.regiao_id,
    })
    .select("id")
    .single();

  if (erroInsercaoContrato || !contrato) {
    revalidatePath("/documentos");
    return {
      ok: true,
      pessoaFicouApta,
      pessoaNome: pessoa.nome_completo,
      mensagem: "Documento aprovado, mas ocorreu um erro ao gerar o registro de contrato.",
    };
  }

  // 7. Renderiza e compila o PDF oficial do contrato
  const corpoComDados = substituirMarcadores(templateEscolhido.corpo_html, {
    nome: pessoa.nome_completo,
    cpf: pessoa.cpf,
    endereco: pessoa.endereco ?? "não informado",
    chavePix: pessoa.chave_pix ?? "não informada",
    objeto: templateEscolhido.objeto,
    valor: formatarValorBRL(valor),
    valorExtenso,
    vigenciaInicio: formatarDataBR(vigenciaInicio),
    vigenciaFim: formatarDataBR(vigenciaFim),
  });

  const pdfBytes = await gerarPdfContrato({
    titulo: `CONTRATO DE PRESTAÇÃO DE SERVIÇOS — ${templateEscolhido.objeto.toUpperCase()}`,
    corpo: htmlParaTexto(corpoComDados),
  });

  const pdfPath = `${organizationId}/${pessoa.id}/contrato_${contrato.id}.pdf`;
  const { error: erroUpload } = await supabase.storage
    .from("contratos")
    .upload(pdfPath, pdfBytes, { contentType: "application/pdf", upsert: true });

  if (!erroUpload) {
    await supabase.from("contratos").update({ caminho_pdf: pdfPath }).eq("id", contrato.id);
  }

  // 8. Transiciona atomicamente: rascunho -> emitido
  await supabase.rpc("gravar_transicao_contrato", {
    p_contrato_id: contrato.id,
    p_status_anterior: "rascunho",
    p_status_novo: "emitido",
    p_observacao: "Emissão automática após aprovação na mesa de conferência documental.",
  });

  // 9. Atualiza canal de envio e transiciona: emitido -> enviado
  await supabase
    .from("contratos")
    .update({
      canal_envio: "email",
      enviado_para: pessoa.email ?? "sem-email-cadastrado",
    })
    .eq("id", contrato.id);

  await supabase.rpc("gravar_transicao_contrato", {
    p_contrato_id: contrato.id,
    p_status_anterior: "emitido",
    p_status_novo: "enviado",
    p_observacao: `Contrato disponibilizado para assinatura pública via link.${pessoa.email ? ` Notificação despachada para ${pessoa.email}.` : ""}`,
  });

  await registerContractWrite({
    supabase,
    organizationId,
    userId,
    contractId: contrato.id,
    action: "emissao",
  });

  // 10. Dispara e-mail com link do contrato para o colaborador
  const baseUrl = process.env.APP_URL || "http://localhost:3000";
  const urlAssinatura = `${baseUrl}/assinar/${tokenAssinatura}`;
  let emailEnviado = false;

  if (pessoa.email) {
    const primeiroNome = pessoa.nome_completo.split(" ")[0];
    const { subject, html, text } = await renderizarEmailContratoEnviado({
      primeiroNome,
      objeto: templateEscolhido.objeto,
      urlAssinatura,
      urlContato: baseUrl,
    });

    const resultadoEnvio = await sendNotification({
      supabase,
      transport: transporteEmailPadrao(),
      organizationId,
      type: "contrato_enviado",
      recipientEmail: pessoa.email,
      entity: "contratos",
      entityId: contrato.id,
      idempotencyKey: idempotencyKey("contrato_enviado", contrato.id),
      subject,
      html,
      text,
    });
    emailEnviado = resultadoEnvio.sent;
  }

  revalidatePath("/documentos");
  revalidatePath("/contratos");
  revalidatePath("/pessoas");
  revalidatePath("/dashboard");

  return {
    ok: true,
    pessoaFicouApta,
    contratoId: contrato.id,
    tokenAssinatura,
    urlAssinatura,
    emailEnviado,
    destinatarioEmail: pessoa.email,
    pessoaNome: pessoa.nome_completo,
    mensagem: emailEnviado
      ? `Documento aprovado! Contrato gerado em PDF e link de assinatura enviado por e-mail para ${pessoa.email}.`
      : pessoa.email
        ? `Documento aprovado e contrato gerado em PDF! Link de assinatura pronto.`
        : `Documento aprovado e contrato gerado em PDF! (Colaborador sem e-mail cadastrado — copie o link de assinatura).`,
  };
}

export async function aprovarDocumento(documentoId: string): Promise<ResultadoAcaoDocumento> {
  return aprovarDocumentoEGerarContrato(documentoId);
}

export async function rejeitarDocumento(
  documentoId: string,
  motivo: string,
): Promise<ResultadoAcaoDocumento> {
  const motivoLimpo = motivo.trim();
  if (!motivoLimpo) {
    return { ok: false, mensagem: "Informe o motivo da rejeição." };
  }

  const supabase = await createClient();
  const { organizationId, userId, papel } = await obterContextoUsuario(supabase);
  if (!organizationId) return { ok: false, mensagem: "Sessão inválida — faça login novamente." };
  if (!PAPEIS_TRIAGEM.includes(papel ?? "")) return { ok: false, mensagem: RECUSA_PAPEL };

  const { data: documento, error } = await supabase
    .from("documentos")
    .update({ status: "rejeitado", motivo_rejeicao: motivoLimpo })
    .eq("id", documentoId)
    .select("id, pessoa_id")
    .single();

  if (error || !documento) {
    return { ok: false, mensagem: "Não foi possível rejeitar o documento." };
  }

  await registerDocumentReview({
    supabase,
    organizationId,
    userId,
    documentId: documento.id,
    action: "rejeicao",
  });

  await dispararDocumentoRejeitadoManual({
    supabase,
    organizationId,
    pessoaId: documento.pessoa_id,
    motivo: motivoLimpo,
    documentoId: documento.id,
  });

  // Cobre também o caso raro de rejeitar um documento de uma pessoa que já
  // estava apta (revoga a aptidão) — não só o caso comum de nunca ter ficado apta.
  const pessoaFicouApta = await reavaliarAptidao({
    supabase,
    organizationId,
    userId,
    pessoaId: documento.pessoa_id,
  });

  revalidatePath("/documentos");
  revalidatePath("/pessoas");
  return { ok: true, pessoaFicouApta };
}

export async function gerarUrlDocumento(
  documentoId: string,
): Promise<{ ok: boolean; url?: string; mensagem?: string }> {
  const supabase = await createClient();
  const { organizationId, userId } = await obterContextoUsuario(supabase);
  if (!organizationId) return { ok: false, mensagem: "Sessão inválida — faça login novamente." };

  const { data: documento } = await supabase
    .from("documentos")
    .select("caminho_storage")
    .eq("id", documentoId)
    .maybeSingle();

  if (!documento) return { ok: false, mensagem: "Documento não encontrado." };

  try {
    const url = await criarUrlAssinada({
      supabase,
      bucket: "documentos",
      caminho: documento.caminho_storage,
      documentId: documentoId,
      organizationId,
      userId,
    });
    return { ok: true, url };
  } catch {
    return { ok: false, mensagem: "Não foi possível gerar o link de acesso." };
  }
}

// ---------------------------------------------------------------------------
// Internas
// ---------------------------------------------------------------------------

/** Recalcula `pessoas.apta` a partir do estado atual dos documentos e, se a pessoa
 * acabou de ficar apta, dispara `pessoa_apta`. Roda depois de toda aprovação E toda
 * rejeição — uma rejeição pode revogar a aptidão de quem já tinha ficado apta. */
async function reavaliarAptidao(params: {
  supabase: SupabaseClient;
  organizationId: string;
  userId: string | null;
  pessoaId: string;
}): Promise<boolean> {
  const { supabase, organizationId, userId, pessoaId } = params;

  const { data: pessoa } = await supabase
    .from("pessoas")
    .select("nome_completo, apta, regiao_id")
    .eq("id", pessoaId)
    .single();
  if (!pessoa) return false;

  const { data: documentos } = await supabase
    .from("documentos")
    .select("tipo, status, versao")
    .eq("pessoa_id", pessoaId);

  const apta = pessoaEstaApta(documentos ?? []);
  if (apta === pessoa.apta) return apta;

  await supabase.from("pessoas").update({ apta }).eq("id", pessoaId);
  await registerPersonWrite({ supabase, organizationId, userId, personId: pessoaId, action: "edicao" });

  if (apta) {
    await dispararPessoaApta({
      supabase,
      organizationId,
      pessoaId,
      nomePessoa: pessoa.nome_completo,
      regiaoId: pessoa.regiao_id,
    });
  }

  return apta;
}

/** "Coordenador responsável" (Seção 6) — interpretado como o coord_regiao da região
 * da pessoa; sem um, cai para qualquer coord_comite da organização. Sem nenhum dos
 * dois, não há para quem enviar — a aprovação em si não fica bloqueada por isso. */
async function dispararPessoaApta(params: {
  supabase: SupabaseClient;
  organizationId: string;
  pessoaId: string;
  nomePessoa: string;
  regiaoId: string | null;
}) {
  const { supabase, organizationId, pessoaId, nomePessoa, regiaoId } = params;

  let destinatario: { email: string } | null = null;
  if (regiaoId) {
    const { data } = await supabase
      .from("usuarios")
      .select("email")
      .eq("regiao_id", regiaoId)
      .eq("papel", "coord_regiao")
      .limit(1)
      .maybeSingle();
    destinatario = data;
  }
  if (!destinatario) {
    const { data } = await supabase
      .from("usuarios")
      .select("email")
      .eq("papel", "coord_comite")
      .limit(1)
      .maybeSingle();
    destinatario = data;
  }
  if (!destinatario) return;

  const baseUrl = process.env.APP_URL || "http://localhost:3000";
  const { subject, html, text } = await renderizarEmailPessoaApta({
    nomePessoa,
    urlPainel: `${baseUrl}/pessoas`,
  });

  // Chave por pessoa (não por evento) — Seção 6 pede "enviado uma única vez", e o
  // caso comum é exatamente isto: virar apta é, na prática, algo que só acontece
  // uma vez na vida da pessoa. Limitação conhecida e documentada em
  // PROGRESSO-FASE-2-3-4.md: se a pessoa perder e reconquistar a aptidão (documento
  // rejeitado depois de já aprovado, e reaprovado depois), o e-mail não volta a
  // sair, porque a chave é a mesma.
  await sendNotification({
    supabase,
    transport: transporteEmailPadrao(),
    organizationId,
    type: "pessoa_apta",
    recipientEmail: destinatario.email,
    entity: "pessoas",
    entityId: pessoaId,
    idempotencyKey: idempotencyKey("pessoa_apta", pessoaId),
    subject,
    html,
    text,
  });
}

/** Rejeição manual (mesa de triagem) — diferente da rejeição automática por
 * dimensão (Route Handler de upload), mas é o mesmo tipo de notificação (Seção 5:
 * um único valor de enum para "documento_rejeitado"). Gera um novo link de coleta
 * para o reenvio, em vez de reaproveitar um token antigo que pode já ter expirado
 * ou sido usado. */
async function dispararDocumentoRejeitadoManual(params: {
  supabase: SupabaseClient;
  organizationId: string;
  pessoaId: string;
  motivo: string;
  documentoId: string;
}) {
  const { supabase, organizationId, pessoaId, motivo, documentoId } = params;

  const { data: pessoa } = await supabase
    .from("pessoas")
    .select("nome_completo, email")
    .eq("id", pessoaId)
    .maybeSingle();
  if (!pessoa?.email) return;

  const token = gerarTokenColeta();
  const expiraEm = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await supabase
    .from("links_coleta")
    .insert({ organizacao_id: organizationId, pessoa_id: pessoaId, token, expira_em: expiraEm.toISOString() });

  const baseUrl = process.env.APP_URL || "http://localhost:3000";
  const primeiroNome = pessoa.nome_completo.split(" ")[0];
  const { subject, html, text } = await renderizarEmailDocumentoRejeitado({
    primeiroNome,
    motivo,
    urlReenvio: `${baseUrl}/coleta/${token}`,
  });

  await sendNotification({
    supabase,
    transport: transporteEmailPadrao(),
    organizationId,
    type: "documento_rejeitado",
    recipientEmail: pessoa.email,
    entity: "documentos",
    entityId: documentoId,
    idempotencyKey: idempotencyKey("documento_rejeitado", documentoId, "manual"),
    subject,
    html,
    text,
  });
}
