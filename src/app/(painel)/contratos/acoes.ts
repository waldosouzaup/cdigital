/**
 * Server Actions de contratos — Fase 2, itens 8 (emissão com PDF), 10 (máquina de
 * estados com eventos_contrato em transação) e 11 (registro de envio disparando
 * contrato_enviado). Toda transição de status passa pela RPC
 * `gravar_transicao_contrato` (migration 0007) — nunca um `.update()` direto no
 * status, para não perder a trava otimista nem o evento correspondente.
 */
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { obterContextoUsuario } from "@/lib/supabase/contexto-usuario";
import { registerContractWrite } from "@/lib/auditoria/registrar";
import { criarUrlAssinada } from "@/lib/documentos/url-assinada";
import { canTransition, type ContractStatus } from "@/lib/contratos/maquina-estados";
import { substituirMarcadores } from "@/lib/contratos/marcadores";
import { gerarPdfContrato, htmlParaTexto } from "@/lib/contratos/gerar-pdf";
import { amountInWords } from "@/lib/contratos/valor-extenso";
import { renderizarEmailContratoEnviado } from "@/emails/contrato-enviado";
import { sendNotification } from "@/lib/notificacoes/enviar";
import { idempotencyKey } from "@/lib/notificacoes/chave-idempotencia";
import { transporteEmailPadrao } from "@/lib/notificacoes/transporte-padrao";

export interface ResultadoAcaoContrato {
  ok: boolean;
  mensagem?: string;
}

function formatarValorBRL(valor: number): string {
  return `R$ ${valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatarDataBR(isoDate: string): string {
  const [ano, mes, dia] = isoDate.split("-");
  return `${dia}/${mes}/${ano}`;
}

// ---------------------------------------------------------------------------
// Emissão (item 8) — cria o contrato em rascunho, gera o PDF e transiciona para
// "emitido" atomicamente.
// ---------------------------------------------------------------------------

export interface EstadoEmitirContrato {
  status: "idle" | "sucesso" | "erro";
  mensagem?: string;
}

export const ESTADO_INICIAL_EMITIR_CONTRATO: EstadoEmitirContrato = { status: "idle" };

export async function emitirContrato(
  _estadoAnterior: EstadoEmitirContrato,
  formData: FormData,
): Promise<EstadoEmitirContrato> {
  const pessoaId = String(formData.get("pessoaId") ?? "");
  const templateId = String(formData.get("templateId") ?? "");
  const vigenciaInicio = String(formData.get("vigenciaInicio") ?? "");
  const vigenciaFim = String(formData.get("vigenciaFim") ?? "");
  const valorTexto = String(formData.get("valor") ?? "").replace(",", ".");

  if (!pessoaId || !templateId || !vigenciaInicio || !vigenciaFim) {
    return { status: "erro", mensagem: "Selecione a pessoa, o modelo e a vigência." };
  }

  const valor = Number(valorTexto);
  if (!valorTexto || Number.isNaN(valor) || valor <= 0) {
    return { status: "erro", mensagem: "Informe um valor maior que zero." };
  }
  if (vigenciaFim < vigenciaInicio) {
    return { status: "erro", mensagem: "A data final da vigência não pode ser anterior à inicial." };
  }

  const supabase = await createClient();
  const { organizationId, userId } = await obterContextoUsuario(supabase);
  if (!organizationId) return { status: "erro", mensagem: "Sessão inválida — faça login novamente." };

  const [{ data: pessoa }, { data: template }] = await Promise.all([
    supabase.from("pessoas").select("nome_completo, cpf, endereco, email").eq("id", pessoaId).maybeSingle(),
    supabase
      .from("templates_contrato")
      .select("nome, objeto, corpo_html")
      .eq("id", templateId)
      .maybeSingle(),
  ]);

  if (!pessoa) return { status: "erro", mensagem: "Pessoa não encontrada." };
  if (!template) return { status: "erro", mensagem: "Modelo de contrato não encontrado." };

  const valorExtenso = amountInWords(valor);

  const { data: contrato, error: erroInsercao } = await supabase
    .from("contratos")
    .insert({
      organizacao_id: organizationId,
      pessoa_id: pessoaId,
      template_id: templateId,
      objeto: template.objeto,
      valor,
      valor_extenso: valorExtenso,
      vigencia_inicio: vigenciaInicio,
      vigencia_fim: vigenciaFim,
    })
    .select("id")
    .single();

  if (erroInsercao || !contrato) {
    return { status: "erro", mensagem: "Não foi possível criar o contrato." };
  }

  // Nunca digitado (Fase 2, item 8: "valor_extenso vem da biblioteca extenso, nunca
  // de digitação") — já veio de amountInWords() acima, aqui só monta o PDF.
  const corpoComDados = substituirMarcadores(template.corpo_html, {
    nome: pessoa.nome_completo,
    cpf: pessoa.cpf,
    endereco: pessoa.endereco ?? "não informado",
    objeto: template.objeto,
    valor: formatarValorBRL(valor),
    valorExtenso,
    vigenciaInicio: formatarDataBR(vigenciaInicio),
    vigenciaFim: formatarDataBR(vigenciaFim),
  });

  const pdfBytes = await gerarPdfContrato({
    titulo: `CONTRATO DE PRESTAÇÃO DE SERVIÇOS — ${template.objeto.toUpperCase()}`,
    corpo: htmlParaTexto(corpoComDados),
  });

  const pdfPath = `${organizationId}/${pessoaId}/contrato_${contrato.id}.pdf`;
  const { error: erroUpload } = await supabase.storage
    .from("contratos")
    .upload(pdfPath, pdfBytes, { contentType: "application/pdf", upsert: false });

  if (erroUpload) {
    // O contrato fica em "rascunho" sem PDF — recuperável (delete e tenta de novo),
    // melhor que marcar "emitido" com um PDF que não existe.
    return { status: "erro", mensagem: "Contrato criado, mas o PDF não pôde ser gerado. Tente emitir de novo." };
  }

  await supabase.from("contratos").update({ caminho_pdf: pdfPath }).eq("id", contrato.id);

  const { error: erroTransicao } = await supabase.rpc("gravar_transicao_contrato", {
    p_contrato_id: contrato.id,
    p_status_anterior: "rascunho",
    p_status_novo: "emitido",
    p_observacao: "Emissão automática com PDF gerado pelo sistema.",
  });

  if (erroTransicao) {
    return {
      status: "erro",
      mensagem: "PDF gerado, mas não foi possível concluir a emissão. Tente de novo.",
    };
  }

  await registerContractWrite({
    supabase,
    organizationId,
    userId,
    contractId: contrato.id,
    action: "emissao",
  });

  revalidatePath("/contratos");
  return { status: "sucesso", mensagem: "Contrato emitido com sucesso." };
}

// ---------------------------------------------------------------------------
// Transições simples (itens 10, 11) — todas passam por gravar_transicao_contrato.
// ---------------------------------------------------------------------------

async function transicionarContrato(params: {
  contractId: string;
  de: ContractStatus;
  para: ContractStatus;
  observacao?: string;
}): Promise<ResultadoAcaoContrato> {
  if (!canTransition(params.de, params.para)) {
    return { ok: false, mensagem: `Transição inválida: "${params.de}" → "${params.para}".` };
  }

  const supabase = await createClient();
  const { organizationId, userId } = await obterContextoUsuario(supabase);
  if (!organizationId) return { ok: false, mensagem: "Sessão inválida — faça login novamente." };

  const { error } = await supabase.rpc("gravar_transicao_contrato", {
    p_contrato_id: params.contractId,
    p_status_anterior: params.de,
    p_status_novo: params.para,
    p_observacao: params.observacao ?? null,
  });

  if (error) {
    return { ok: false, mensagem: "Não foi possível concluir — o status pode ter mudado. Recarregue a página." };
  }

  await registerContractWrite({
    supabase,
    organizationId,
    userId,
    contractId: params.contractId,
    action: `transicao_${params.para}`,
  });

  revalidatePath("/contratos");
  return { ok: true };
}

/** Item 11: "Registro de envio com data, canal e destinatário, disparando
 * contrato_enviado." Grava canal/destinatário antes da transição — não faz parte
 * da garantia de atomicidade da máquina de estados (são só metadados
 * descritivos, não usados para validar a transição em si). */
export async function enviarContrato(
  contractId: string,
  canal: "email" | "whatsapp" | "presencial",
  destinatario: string,
): Promise<ResultadoAcaoContrato> {
  const supabase = await createClient();
  const { organizationId } = await obterContextoUsuario(supabase);
  if (!organizationId) return { ok: false, mensagem: "Sessão inválida — faça login novamente." };

  await supabase
    .from("contratos")
    .update({ canal_envio: canal, enviado_para: destinatario })
    .eq("id", contractId);

  const resultado = await transicionarContrato({
    contractId,
    de: "emitido",
    para: "enviado",
    observacao: `Enviado por ${canal} para ${destinatario}.`,
  });
  if (!resultado.ok) return resultado;

  await dispararContratoEnviado({ supabase, organizationId, contractId });

  return resultado;
}

export async function marcarContratoAssinado(contractId: string): Promise<ResultadoAcaoContrato> {
  return transicionarContrato({
    contractId,
    de: "enviado",
    para: "assinado",
    observacao: "Assinatura registrada manualmente pela coordenação.",
  });
}

/** Item 13 (parcial): a transição de estado é real; a geração do termo de distrato
 * em si (documento) ainda não existe — deferida, registrada em
 * PROGRESSO-FASE-2-3-4.md. */
export async function distratarContrato(contractId: string): Promise<ResultadoAcaoContrato> {
  return transicionarContrato({
    contractId,
    de: "assinado",
    para: "distratado",
    observacao: "Distrato registrado pela coordenação.",
  });
}

async function dispararContratoEnviado(params: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  organizationId: string;
  contractId: string;
}) {
  const { supabase, organizationId, contractId } = params;

  const { data: contrato } = await supabase
    .from("contratos")
    .select("objeto, pessoas ( nome_completo, email )")
    .eq("id", contractId)
    .maybeSingle<{ objeto: string; pessoas: { nome_completo: string; email: string | null } | null }>();

  if (!contrato?.pessoas?.email) return;

  const baseUrl = process.env.APP_URL || "http://localhost:3000";
  const primeiroNome = contrato.pessoas.nome_completo.split(" ")[0];
  const { subject, html, text } = await renderizarEmailContratoEnviado({
    primeiroNome,
    objeto: contrato.objeto,
    urlContato: baseUrl,
  });

  // Chave determinística por contrato (Seção 6, regra 1) — "disparar contrato_enviado
  // duas vezes para o mesmo contrato envia um único e-mail": um segundo clique no
  // botão de envio já é bloqueado pela trava otimista da RPC (o contrato não está
  // mais em "emitido"), e mesmo que chegasse aqui, o índice único de
  // chave_idempotencia recusaria o segundo insert.
  await sendNotification({
    supabase,
    transport: transporteEmailPadrao(),
    organizationId,
    type: "contrato_enviado",
    recipientEmail: contrato.pessoas.email,
    entity: "contratos",
    entityId: contractId,
    idempotencyKey: idempotencyKey("contrato_enviado", contractId),
    subject,
    html,
    text,
  });
}

export async function gerarUrlPdfContrato(
  contractId: string,
): Promise<{ ok: boolean; url?: string; mensagem?: string }> {
  const supabase = await createClient();
  const { organizationId, userId } = await obterContextoUsuario(supabase);
  if (!organizationId) return { ok: false, mensagem: "Sessão inválida — faça login novamente." };

  const { data: contrato } = await supabase
    .from("contratos")
    .select("caminho_pdf")
    .eq("id", contractId)
    .maybeSingle();

  if (!contrato?.caminho_pdf) {
    return { ok: false, mensagem: "Este contrato ainda não tem PDF gerado." };
  }

  try {
    const url = await criarUrlAssinada({
      supabase,
      bucket: "contratos",
      caminho: contrato.caminho_pdf,
      documentId: contractId,
      organizationId,
      userId,
    });
    return { ok: true, url };
  } catch {
    return { ok: false, mensagem: "Não foi possível gerar o link de acesso ao PDF." };
  }
}
