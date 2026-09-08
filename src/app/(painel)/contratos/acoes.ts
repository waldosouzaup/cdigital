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

interface DadosParaEmissao {
  nomeCompleto: string;
  cpf: string;
  endereco: string | null;
}

interface TemplateParaEmissao {
  objeto: string;
  corpoHtml: string;
}

interface ParametrosEmissaoIndividual {
  pessoaId: string;
  templateId: string;
  template: TemplateParaEmissao;
  valor: number;
  vigenciaInicio: string;
  vigenciaFim: string;
}

/**
 * Núcleo da emissão — extraído para ser reaproveitado pela emissão individual
 * (`emitirContrato`) e pela emissão em lote (`emitirContratosEmLote`, item 9),
 * que compartilham exatamente a mesma sequência: criar em rascunho, gerar PDF,
 * subir, transicionar para "emitido". Recebe `template` e `pessoa` já
 * carregados — quem chama decide se busca um por vez (emissão individual) ou
 * todos de uma vez antes do laço (lote, evita N pequenas consultas repetidas).
 */
async function emitirContratoParaPessoa(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  userId: string | null,
  pessoa: DadosParaEmissao,
  params: ParametrosEmissaoIndividual,
): Promise<{ ok: boolean; contractId?: string; mensagem?: string }> {
  const valorExtenso = amountInWords(params.valor);

  const { data: contrato, error: erroInsercao } = await supabase
    .from("contratos")
    .insert({
      organizacao_id: organizationId,
      pessoa_id: params.pessoaId,
      template_id: params.templateId,
      objeto: params.template.objeto,
      valor: params.valor,
      valor_extenso: valorExtenso,
      vigencia_inicio: params.vigenciaInicio,
      vigencia_fim: params.vigenciaFim,
    })
    .select("id")
    .single();

  if (erroInsercao || !contrato) {
    return { ok: false, mensagem: "Não foi possível criar o contrato." };
  }

  // Nunca digitado (Fase 2, item 8: "valor_extenso vem da biblioteca extenso, nunca
  // de digitação") — já veio de amountInWords() acima, aqui só monta o PDF.
  const corpoComDados = substituirMarcadores(params.template.corpoHtml, {
    nome: pessoa.nomeCompleto,
    cpf: pessoa.cpf,
    endereco: pessoa.endereco ?? "não informado",
    objeto: params.template.objeto,
    valor: formatarValorBRL(params.valor),
    valorExtenso,
    vigenciaInicio: formatarDataBR(params.vigenciaInicio),
    vigenciaFim: formatarDataBR(params.vigenciaFim),
  });

  const pdfBytes = await gerarPdfContrato({
    titulo: `CONTRATO DE PRESTAÇÃO DE SERVIÇOS — ${params.template.objeto.toUpperCase()}`,
    corpo: htmlParaTexto(corpoComDados),
  });

  const pdfPath = `${organizationId}/${params.pessoaId}/contrato_${contrato.id}.pdf`;
  const { error: erroUpload } = await supabase.storage
    .from("contratos")
    .upload(pdfPath, pdfBytes, { contentType: "application/pdf", upsert: false });

  if (erroUpload) {
    // O contrato fica em "rascunho" sem PDF — recuperável (delete e tenta de novo),
    // melhor que marcar "emitido" com um PDF que não existe.
    return { ok: false, mensagem: "Contrato criado, mas o PDF não pôde ser gerado." };
  }

  await supabase.from("contratos").update({ caminho_pdf: pdfPath }).eq("id", contrato.id);

  const { error: erroTransicao } = await supabase.rpc("gravar_transicao_contrato", {
    p_contrato_id: contrato.id,
    p_status_anterior: "rascunho",
    p_status_novo: "emitido",
    p_observacao: "Emissão automática com PDF gerado pelo sistema.",
  });

  if (erroTransicao) {
    return { ok: false, mensagem: "PDF gerado, mas não foi possível concluir a emissão." };
  }

  await registerContractWrite({
    supabase,
    organizationId,
    userId,
    contractId: contrato.id,
    action: "emissao",
  });

  return { ok: true, contractId: contrato.id };
}

function validarCamposComunsDeEmissao(params: {
  templateId: string;
  vigenciaInicio: string;
  vigenciaFim: string;
  valorTexto: string;
}): { ok: true; valor: number } | { ok: false; mensagem: string } {
  if (!params.templateId || !params.vigenciaInicio || !params.vigenciaFim) {
    return { ok: false, mensagem: "Selecione o modelo e a vigência." };
  }
  const valor = Number(params.valorTexto.replace(",", "."));
  if (!params.valorTexto || Number.isNaN(valor) || valor <= 0) {
    return { ok: false, mensagem: "Informe um valor maior que zero." };
  }
  if (params.vigenciaFim < params.vigenciaInicio) {
    return { ok: false, mensagem: "A data final da vigência não pode ser anterior à inicial." };
  }
  return { ok: true, valor };
}

export async function emitirContrato(
  _estadoAnterior: EstadoEmitirContrato,
  formData: FormData,
): Promise<EstadoEmitirContrato> {
  const pessoaId = String(formData.get("pessoaId") ?? "");
  const templateId = String(formData.get("templateId") ?? "");
  const vigenciaInicio = String(formData.get("vigenciaInicio") ?? "");
  const vigenciaFim = String(formData.get("vigenciaFim") ?? "");
  const valorTexto = String(formData.get("valor") ?? "");

  if (!pessoaId) return { status: "erro", mensagem: "Selecione a pessoa." };

  const camposComuns = validarCamposComunsDeEmissao({ templateId, vigenciaInicio, vigenciaFim, valorTexto });
  if (!camposComuns.ok) return { status: "erro", mensagem: camposComuns.mensagem };

  const supabase = await createClient();
  const { organizationId, userId } = await obterContextoUsuario(supabase);
  if (!organizationId) return { status: "erro", mensagem: "Sessão inválida — faça login novamente." };

  const [{ data: pessoa }, { data: template }] = await Promise.all([
    supabase.from("pessoas").select("nome_completo, cpf, endereco").eq("id", pessoaId).maybeSingle(),
    supabase.from("templates_contrato").select("objeto, corpo_html").eq("id", templateId).maybeSingle(),
  ]);

  if (!pessoa) return { status: "erro", mensagem: "Pessoa não encontrada." };
  if (!template) return { status: "erro", mensagem: "Modelo de contrato não encontrado." };

  const resultado = await emitirContratoParaPessoa(
    supabase,
    organizationId,
    userId,
    { nomeCompleto: pessoa.nome_completo, cpf: pessoa.cpf, endereco: pessoa.endereco },
    {
      pessoaId,
      templateId,
      template: { objeto: template.objeto, corpoHtml: template.corpo_html },
      valor: camposComuns.valor,
      vigenciaInicio,
      vigenciaFim,
    },
  );

  if (!resultado.ok) {
    return { status: "erro", mensagem: resultado.mensagem ?? "Não foi possível emitir o contrato." };
  }

  revalidatePath("/contratos");
  return { status: "sucesso", mensagem: "Contrato emitido com sucesso." };
}

// ---------------------------------------------------------------------------
// Emissão em lote (item 9) — mesmo template/valor/vigência para N pessoas.
// ---------------------------------------------------------------------------

export interface EstadoEmitirLote {
  status: "idle" | "sucesso" | "erro";
  mensagem?: string;
  sucessos?: number;
  falhas?: { pessoaNome: string; motivo: string }[];
}

export const ESTADO_INICIAL_EMITIR_LOTE: EstadoEmitirLote = { status: "idle" };

export async function emitirContratosEmLote(
  _estadoAnterior: EstadoEmitirLote,
  formData: FormData,
): Promise<EstadoEmitirLote> {
  const pessoaIds = formData.getAll("pessoaIds").map(String).filter(Boolean);
  const templateId = String(formData.get("templateId") ?? "");
  const vigenciaInicio = String(formData.get("vigenciaInicio") ?? "");
  const vigenciaFim = String(formData.get("vigenciaFim") ?? "");
  const valorTexto = String(formData.get("valor") ?? "");

  if (pessoaIds.length === 0) {
    return { status: "erro", mensagem: "Selecione ao menos uma pessoa." };
  }

  const camposComuns = validarCamposComunsDeEmissao({ templateId, vigenciaInicio, vigenciaFim, valorTexto });
  if (!camposComuns.ok) return { status: "erro", mensagem: camposComuns.mensagem };

  const supabase = await createClient();
  const { organizationId, userId } = await obterContextoUsuario(supabase);
  if (!organizationId) return { status: "erro", mensagem: "Sessão inválida — faça login novamente." };

  const { data: template } = await supabase
    .from("templates_contrato")
    .select("objeto, corpo_html")
    .eq("id", templateId)
    .maybeSingle();
  if (!template) return { status: "erro", mensagem: "Modelo de contrato não encontrado." };

  const { data: pessoas } = await supabase
    .from("pessoas")
    .select("id, nome_completo, cpf, endereco")
    .in("id", pessoaIds);
  const pessoaPorId = new Map((pessoas ?? []).map((p) => [p.id, p]));

  const falhas: { pessoaNome: string; motivo: string }[] = [];
  let sucessos = 0;

  // Sequencial, não Promise.all: cada emissão já faz várias chamadas de rede
  // (insert, geração de PDF, upload, RPC de transição) — paralelizar dezenas de
  // pessoas de uma vez arrisca esgotar conexões no ambiente serverless. N
  // esperado aqui é dezenas, não milhares (Seção 11: maior objeto do comitê tem
  // 14 pessoas) — sequencial é aceitável.
  for (const pessoaId of pessoaIds) {
    const pessoa = pessoaPorId.get(pessoaId);
    if (!pessoa) {
      falhas.push({ pessoaNome: pessoaId, motivo: "Pessoa não encontrada." });
      continue;
    }

    const resultado = await emitirContratoParaPessoa(
      supabase,
      organizationId,
      userId,
      { nomeCompleto: pessoa.nome_completo, cpf: pessoa.cpf, endereco: pessoa.endereco },
      {
        pessoaId,
        templateId,
        template: { objeto: template.objeto, corpoHtml: template.corpo_html },
        valor: camposComuns.valor,
        vigenciaInicio,
        vigenciaFim,
      },
    );

    if (resultado.ok) {
      sucessos++;
    } else {
      falhas.push({ pessoaNome: pessoa.nome_completo, motivo: resultado.mensagem ?? "Falha desconhecida." });
    }
  }

  revalidatePath("/contratos");

  if (sucessos === 0) {
    return { status: "erro", mensagem: "Nenhum contrato pôde ser emitido.", sucessos, falhas };
  }

  return {
    status: "sucesso",
    mensagem: `${sucessos} contrato(s) emitido(s) com sucesso${falhas.length ? `; ${falhas.length} falharam` : ""}.`,
    sucessos,
    falhas,
  };
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

/** Item 13: "Distrato gerando termo, sem apagar o contrato original." Gera um PDF
 * (mesmo `gerarPdfContrato` da emissão, conteúdo diferente) referenciando o
 * contrato original por objeto/valor/vigência — nunca cria um registro novo,
 * só anexa `distratoTermPath` ao mesmo contrato e transiciona seu status. */
export async function distratarContrato(
  contractId: string,
  motivo: string,
): Promise<ResultadoAcaoContrato> {
  const motivoLimpo = motivo.trim();
  if (!motivoLimpo) return { ok: false, mensagem: "Informe o motivo do distrato." };

  const supabase = await createClient();
  // userId não é usado aqui: transicionarContrato() já resolve o contexto do
  // usuário de novo por conta própria para o auditoria do evento de transição.
  const { organizationId } = await obterContextoUsuario(supabase);
  if (!organizationId) return { ok: false, mensagem: "Sessão inválida — faça login novamente." };

  const { data: contrato } = await supabase
    .from("contratos")
    .select("pessoa_id, objeto, valor, valor_extenso, vigencia_inicio, vigencia_fim, pessoas ( nome_completo, cpf )")
    .eq("id", contractId)
    .maybeSingle<{
      pessoa_id: string;
      objeto: string;
      valor: string;
      valor_extenso: string;
      vigencia_inicio: string;
      vigencia_fim: string;
      pessoas: { nome_completo: string; cpf: string } | null;
    }>();

  if (!contrato) return { ok: false, mensagem: "Contrato não encontrado." };

  const corpoTermo = [
    `CONTRATADO(A): ${contrato.pessoas?.nome_completo ?? "—"}, CPF ${contrato.pessoas?.cpf ?? "—"}.`,
    "",
    `Fica distratado, a partir desta data, o contrato de ${contrato.objeto}, com vigência original de ` +
      `${formatarDataBR(contrato.vigencia_inicio)} a ${formatarDataBR(contrato.vigencia_fim)} e valor de ` +
      `${formatarValorBRL(Number(contrato.valor))} (${contrato.valor_extenso}).`,
    "",
    `MOTIVO: ${motivoLimpo}`,
    "",
    "O contrato original permanece arquivado, sem alteração, para fins de prestação de contas.",
  ].join("\n\n");

  const pdfBytes = await gerarPdfContrato({
    titulo: "TERMO DE DISTRATO",
    corpo: corpoTermo,
  });

  const caminhoTermo = `${organizationId}/${contrato.pessoa_id}/distrato_${contractId}.pdf`;
  const { error: erroUpload } = await supabase.storage
    .from("contratos")
    .upload(caminhoTermo, pdfBytes, { contentType: "application/pdf", upsert: true });

  if (erroUpload) {
    return { ok: false, mensagem: "Não foi possível gerar o termo de distrato. Tente de novo." };
  }

  await supabase.from("contratos").update({ caminho_termo_distrato: caminhoTermo }).eq("id", contractId);

  return transicionarContrato({
    contractId,
    de: "assinado",
    para: "distratado",
    observacao: `Distrato registrado pela coordenação. Motivo: ${motivoLimpo}`,
  });
}

/** Fecha a cadeia do distrato (Seção 7: distratado → distrato_assinado) — mesma
 * marcação presencial simples de `marcarContratoAssinado`, sem upload de arquivo
 * novo (o termo em si já foi anexado em `distratarContrato`). */
export async function marcarDistratoAssinado(contractId: string): Promise<ResultadoAcaoContrato> {
  return transicionarContrato({
    contractId,
    de: "distratado",
    para: "distrato_assinado",
    observacao: "Recebimento do termo de distrato confirmado pela coordenação.",
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
  versao: "gerado" | "assinado" | "distrato" = "gerado",
): Promise<{ ok: boolean; url?: string; mensagem?: string }> {
  const supabase = await createClient();
  const { organizationId, userId } = await obterContextoUsuario(supabase);
  if (!organizationId) return { ok: false, mensagem: "Sessão inválida — faça login novamente." };

  const { data: contrato } = await supabase
    .from("contratos")
    .select("caminho_pdf, caminho_pdf_assinado, caminho_termo_distrato")
    .eq("id", contractId)
    .maybeSingle();

  const caminhoPorVersao = {
    gerado: contrato?.caminho_pdf,
    assinado: contrato?.caminho_pdf_assinado,
    distrato: contrato?.caminho_termo_distrato,
  } as const;
  const caminho = caminhoPorVersao[versao];

  if (!caminho) {
    const mensagens = {
      gerado: "Este contrato ainda não tem PDF gerado.",
      assinado: "Este contrato ainda não tem PDF assinado anexado.",
      distrato: "Este contrato ainda não tem termo de distrato gerado.",
    } as const;
    return { ok: false, mensagem: mensagens[versao] };
  }

  try {
    const url = await criarUrlAssinada({
      supabase,
      bucket: "contratos",
      caminho,
      documentId: contractId,
      organizationId,
      userId,
    });
    return { ok: true, url };
  } catch {
    return { ok: false, mensagem: "Não foi possível gerar o link de acesso ao PDF." };
  }
}
