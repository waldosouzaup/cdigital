/**
 * Server Actions de contratos — Fase 2, itens 8 (emissão com PDF), 10 (máquina de
 * estados com eventos_contrato em transação) e 11 (registro de envio disparando
 * contrato_enviado). Toda transição de status passa pela RPC
 * `gravar_transicao_contrato` (migration 0007) — nunca um `.update()` direto no
 * status, para não perder a trava otimista nem o evento correspondente.
 */
"use server";

import { PDFDocument } from "pdf-lib";
import { randomBytes, createHash } from "node:crypto";
import { garantirPdfCompleto } from "@/lib/contratos/documento";
import { nomeArquivoContrato } from "@/lib/contratos/nome-arquivo";
import { listarPessoasAptasSemContratoAtivo } from "./dados";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { obterContextoUsuario } from "@/lib/supabase/contexto-usuario";
import { registerContractWrite } from "@/lib/auditoria/registrar";
import { criarUrlAssinada } from "@/lib/documentos/url-assinada";
import { canTransition, type ContractStatus } from "@/lib/contratos/maquina-estados";
import { gerarPdfContrato } from "@/lib/contratos/gerar-pdf";
import { amountInWords } from "@/lib/contratos/valor-extenso";
import { calcularProporcionalDistrato } from "@/lib/contratos/distrato";
import {
  montarDadosDistrato,
  substituirMarcadoresDistrato,
} from "@/lib/contratos/template-distrato";
import { buscarTemplateDistrato } from "../configuracoes/dados";
import { renderizarEmailContratoEnviado } from "@/emails/contrato-enviado";
import { renderizarEmailContratoAssinado } from "@/emails/contrato-assinado";
import { renderizarEmailDistratoEnviado } from "@/emails/distrato-enviado";
import { sendNotification } from "@/lib/notificacoes/enviar";
import { idempotencyKey } from "@/lib/notificacoes/chave-idempotencia";
import { transporteEmailPadrao } from "@/lib/notificacoes/transporte-padrao";
import type { EstadoEmitirContrato, EstadoEmitirLote } from "./estado";

export interface ResultadoAcaoContrato {
  ok: boolean;
  mensagem?: string;
}

// Trava de papel (migration 0016): emitir e transicionar contrato é exclusivo de
// gestor e coord_comite. As policies `contratos_*` e o RLS de
// `gravar_transicao_contrato` (invoker) já barram os demais; a checagem aqui
// devolve mensagem clara.
const PAPEIS_CONTRATO = ["gestor", "coord_comite"];
const RECUSA_PAPEL_CONTRATO =
  "Só gestores ou coordenadores de comitê podem emitir ou movimentar contratos.";

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

interface DadosParaEmissao {
  nomeCompleto: string;
  cpf: string;
  endereco: string | null;
  chavePix: string | null;
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
  _pessoa: DadosParaEmissao,
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

  try {
    await garantirPdfCompleto(supabase, contrato.id);
  } catch (erro) {
    return {
      ok: false,
      mensagem: erro instanceof Error ? erro.message : "Não foi possível gerar o PDF.",
    };
  }

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

  const camposComuns = validarCamposComunsDeEmissao({
    templateId,
    vigenciaInicio,
    vigenciaFim,
    valorTexto,
  });
  if (!camposComuns.ok) return { status: "erro", mensagem: camposComuns.mensagem };

  const supabase = await createClient();
  const { organizationId, userId, papel } = await obterContextoUsuario(supabase);
  if (!organizationId)
    return { status: "erro", mensagem: "Sessão inválida — faça login novamente." };
  if (!PAPEIS_CONTRATO.includes(papel ?? ""))
    return { status: "erro", mensagem: RECUSA_PAPEL_CONTRATO };

  const [{ data: pessoa }, { data: template }] = await Promise.all([
    supabase
      .from("pessoas")
      .select("nome_completo, cpf, endereco, chave_pix, apta")
      .eq("id", pessoaId)
      .maybeSingle(),
    supabase
      .from("templates_contrato")
      .select("objeto, corpo_html")
      .eq("id", templateId)
      .maybeSingle(),
  ]);

  if (!pessoa) return { status: "erro", mensagem: "Pessoa não encontrada." };
  if (!template) return { status: "erro", mensagem: "Modelo de contrato não encontrado." };

  if (!pessoa.apta) {
    return {
      status: "erro",
      mensagem:
        "O contrato só pode ser gerado e enviado após o gestor conferir e aprovar ambos os documentos obrigatórios (Identidade e Comprovante de Residência).",
    };
  }

  const resultado = await emitirContratoParaPessoa(
    supabase,
    organizationId,
    userId,
    {
      nomeCompleto: pessoa.nome_completo,
      cpf: pessoa.cpf,
      endereco: pessoa.endereco,
      chavePix: pessoa.chave_pix,
    },
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
    return {
      status: "erro",
      mensagem: resultado.mensagem ?? "Não foi possível emitir o contrato.",
    };
  }

  revalidatePath("/contratos");
  return { status: "sucesso", mensagem: "Contrato emitido com sucesso." };
}

// ---------------------------------------------------------------------------
// Emissão em lote (item 9) — mesmo template/valor/vigência para N pessoas.
// ---------------------------------------------------------------------------

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

  const camposComuns = validarCamposComunsDeEmissao({
    templateId,
    vigenciaInicio,
    vigenciaFim,
    valorTexto,
  });
  if (!camposComuns.ok) return { status: "erro", mensagem: camposComuns.mensagem };

  const supabase = await createClient();
  const { organizationId, userId, papel } = await obterContextoUsuario(supabase);
  if (!organizationId)
    return { status: "erro", mensagem: "Sessão inválida — faça login novamente." };
  if (!PAPEIS_CONTRATO.includes(papel ?? ""))
    return { status: "erro", mensagem: RECUSA_PAPEL_CONTRATO };

  const { data: template } = await supabase
    .from("templates_contrato")
    .select("objeto, corpo_html")
    .eq("id", templateId)
    .maybeSingle();
  if (!template) return { status: "erro", mensagem: "Modelo de contrato não encontrado." };

  const { data: pessoas } = await supabase
    .from("pessoas")
    .select("id, nome_completo, cpf, endereco, chave_pix, apta")
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

    if (!pessoa.apta) {
      falhas.push({
        pessoaNome: pessoa.nome_completo,
        motivo:
          "Colaborador sem ambos os documentos obrigatórios aprovados (Identidade e Comprovante de Residência).",
      });
      continue;
    }

    const resultado = await emitirContratoParaPessoa(
      supabase,
      organizationId,
      userId,
      {
        nomeCompleto: pessoa.nome_completo,
        cpf: pessoa.cpf,
        endereco: pessoa.endereco,
        chavePix: pessoa.chave_pix,
      },
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
      falhas.push({
        pessoaNome: pessoa.nome_completo,
        motivo: resultado.mensagem ?? "Falha desconhecida.",
      });
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
  const { organizationId, userId, papel } = await obterContextoUsuario(supabase);
  if (!organizationId) return { ok: false, mensagem: "Sessão inválida — faça login novamente." };
  if (!PAPEIS_CONTRATO.includes(papel ?? "")) return { ok: false, mensagem: RECUSA_PAPEL_CONTRATO };

  const { error } = await supabase.rpc("gravar_transicao_contrato", {
    p_contrato_id: params.contractId,
    p_status_anterior: params.de,
    p_status_novo: params.para,
    p_observacao: params.observacao ?? null,
  });

  if (error) {
    return {
      ok: false,
      mensagem: "Não foi possível concluir — o status pode ter mudado. Recarregue a página.",
    };
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
  const { organizationId, papel } = await obterContextoUsuario(supabase);
  if (!organizationId) return { ok: false, mensagem: "Sessão inválida — faça login novamente." };
  if (!PAPEIS_CONTRATO.includes(papel ?? "")) return { ok: false, mensagem: RECUSA_PAPEL_CONTRATO };

  if (canal === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(destinatario)) {
    return { ok: false, mensagem: "Informe um e-mail válido." };
  }
  const link = await prepararLinkAssinatura(contractId);
  if (!link.ok || !link.url) return link;
  const { error: metadataError } = await supabase
    .from("contratos")
    .update({ canal_envio: canal, enviado_para: destinatario })
    .eq("id", contractId);
  if (metadataError) return { ok: false, mensagem: "Não foi possível registrar o destinatário." };
  if (canal !== "email")
    return {
      ok: true,
      mensagem:
        "Link preparado. Use o botão Link de assinatura para copiar e compartilhar com o colaborador.",
    };
  const baseUrl = process.env.APP_URL;
  if (!baseUrl)
    return {
      ok: false,
      mensagem:
        "Link preparado. Configure APP_URL com o endereço público do sistema para enviar por e-mail. Enquanto isso, copie o link de assinatura.",
    };
  try {
    const envio = await dispararContratoEnviado({
      supabase,
      organizationId,
      contractId,
      destinatario,
      urlAssinatura: new URL(link.url, baseUrl).href,
    });
    return envio?.sent
      ? { ok: true, mensagem: "Link de assinatura enviado por e-mail." }
      : {
          ok: false,
          mensagem:
            envio?.reason === "duplicate"
              ? "Este envio já foi registrado. Consulte o histórico de notificações."
              : "O envio do e-mail falhou. Você pode copiar o link de assinatura e compartilhá-lo.",
        };
  } catch {
    return {
      ok: false,
      mensagem: "Link preparado, mas não foi possível enviar o e-mail. Copie o link de assinatura.",
    };
  }
}

export async function marcarContratoAssinado(contractId: string): Promise<ResultadoAcaoContrato> {
  const transicao = await transicionarContrato({
    contractId,
    de: "enviado",
    para: "assinado",
    observacao: "Assinatura registrada manualmente pela coordenação.",
  });

  if (transicao.ok) {
    try {
      const supabase = await createClient();
      const { organizationId } = await obterContextoUsuario(supabase);

      const { data: c } = await supabase
        .from("contratos")
        .select("objeto, token_assinatura, pessoas(nome_completo, email)")
        .eq("id", contractId)
        .maybeSingle<{
          objeto: string;
          token_assinatura: string | null;
          pessoas: { nome_completo: string; email: string | null } | null;
        }>();

      if (organizationId && c?.pessoas?.email && c.token_assinatura) {
        const primeiroNome = c.pessoas.nome_completo.split(" ")[0];
        const agora = new Date().toLocaleString("pt-BR", {
          timeZone: "America/Sao_Paulo",
          dateStyle: "short",
          timeStyle: "short",
        });
        const baseUrl = process.env.APP_URL || "http://localhost:3000";
        const urlContratoAssinado = `${baseUrl}/assinar/${c.token_assinatura}`;
        const urlDownloadPdf = `${baseUrl}/api/contratos/publico/${c.token_assinatura}/pdf`;

        const { subject, html, text } = await renderizarEmailContratoAssinado({
          primeiroNome,
          objeto: c.objeto,
          dataAssinatura: agora,
          urlContratoAssinado,
          urlDownloadPdf,
          urlContato: baseUrl,
        });

        await sendNotification({
          supabase,
          transport: transporteEmailPadrao(),
          organizationId,
          type: "contrato_assinado",
          recipientEmail: c.pessoas.email,
          entity: "contratos",
          entityId: contractId,
          idempotencyKey: idempotencyKey("contrato_assinado", contractId),
          subject,
          html,
          text,
        });
      }
    } catch {
      // Disparo de notificação é secundário
    }
  }

  return transicao;
}

/** Item 13: "Distrato gerando termo, sem apagar o contrato original." Gera um PDF
 * (mesmo `gerarPdfContrato` da emissão, conteúdo diferente) referenciando o
 * contrato original por objeto/valor/vigência — nunca cria um registro novo,
 * só anexa `distratoTermPath` ao mesmo contrato e transiciona seu status. */
export async function distratarContrato(
  contractId: string,
  motivo: string,
  dataDistrato?: string,
): Promise<ResultadoAcaoContrato> {
  const motivoLimpo = motivo.trim();
  if (!motivoLimpo) return { ok: false, mensagem: "Informe o motivo do distrato." };

  const supabase = await createClient();
  // userId não é usado aqui: transicionarContrato() já resolve o contexto do
  // usuário de novo por conta própria para o auditoria do evento de transição.
  const { organizationId, papel } = await obterContextoUsuario(supabase);
  if (!organizationId) return { ok: false, mensagem: "Sessão inválida — faça login novamente." };
  if (!PAPEIS_CONTRATO.includes(papel ?? "")) return { ok: false, mensagem: RECUSA_PAPEL_CONTRATO };

  const { data: contrato } = await supabase
    .from("contratos")
    .select(
      "pessoa_id, objeto, valor, valor_extenso, vigencia_inicio, vigencia_fim, pessoas ( nome_completo, cpf, endereco, email )",
    )
    .eq("id", contractId)
    .maybeSingle<{
      pessoa_id: string;
      objeto: string;
      valor: string;
      valor_extenso: string;
      vigencia_inicio: string;
      vigencia_fim: string;
      pessoas: { nome_completo: string; cpf: string; endereco: string | null; email: string | null } | null;
    }>();

  if (!contrato) return { ok: false, mensagem: "Contrato não encontrado." };

  const dataDistratoEfetiva =
    dataDistrato?.trim() || new Date().toISOString().split("T")[0];

  if (dataDistratoEfetiva < contrato.vigencia_inicio) {
    return {
      ok: false,
      mensagem: `A data do distrato (${formatarDataBR(dataDistratoEfetiva)}) não pode ser anterior ao início da vigência (${formatarDataBR(contrato.vigencia_inicio)}).`,
    };
  }

  const calculo = calcularProporcionalDistrato({
    vigenciaInicio: contrato.vigencia_inicio,
    vigenciaFim: contrato.vigencia_fim,
    dataDistrato: dataDistratoEfetiva,
    valor: Number(contrato.valor),
  });

  // O termo passou a ser editável em /configuracoes?aba=modelos (migration 0034).
  // Sem modelo salvo, `buscarTemplateDistrato` devolve o termo oficial de fábrica,
  // que é o mesmo texto que `montarTextoTermoDistrato` sempre gerou.
  const modeloDistrato = await buscarTemplateDistrato();
  const corpoTermo = substituirMarcadoresDistrato(
    modeloDistrato.corpoHtml,
    montarDadosDistrato({
      contratadoNome: contrato.pessoas?.nome_completo ?? "—",
      contratadoCpf: contrato.pessoas?.cpf ?? "—",
      contratadoEndereco: contrato.pessoas?.endereco ?? null,
      objeto: contrato.objeto,
      motivo: motivoLimpo,
      calculo,
    }),
  );

  const pdfBytes = await gerarPdfContrato({
    titulo: "RESCISÃO DE CONTRATO DE PRESTAÇÃO DE SERVIÇOS",
    corpo: corpoTermo,
  });

  const caminhoTermo = `${organizationId}/${contrato.pessoa_id}/distrato_${contractId}.pdf`;
  const { error: erroUpload } = await supabase.storage
    .from("contratos")
    .upload(caminhoTermo, pdfBytes, { contentType: "application/pdf", upsert: true });

  if (erroUpload) {
    return { ok: false, mensagem: "Não foi possível gerar o termo de distrato. Tente de novo." };
  }

  await supabase
    .from("contratos")
    .update({ caminho_termo_distrato: caminhoTermo })
    .eq("id", contractId);

  const valorFormatado = formatarValorBRL(calculo.valorProporcional);
  const periodoFormatado = `${calculo.vigenciaInicioFormatada} a ${calculo.dataDistratoFormatada} (${calculo.diasTrabalhados}/${calculo.diasTotais} dias)`;
  const resultadoTransicao = await transicionarContrato({
    contractId,
    de: "assinado",
    para: "distratado",
    observacao: `Distrato registrado pela coordenação. Período trabalhado: ${periodoFormatado}. Valor proporcional: ${valorFormatado}. Motivo: ${motivoLimpo}`,
  });

  if (resultadoTransicao.ok && contrato.pessoas?.email) {
    try {
      await dispararDistratoEnviado({
        supabase,
        organizationId,
        contractId,
        destinatario: contrato.pessoas.email,
        primeiroNome: contrato.pessoas.nome_completo.split(" ")[0],
        objeto: contrato.objeto,
        dataDistrato: calculo.dataDistratoFormatada,
        periodoTrabalhado: periodoFormatado,
        valorProporcional: valorFormatado,
        motivo: motivoLimpo,
      });
    } catch {
      // Disparo de notificação é secundário e não invalida o registro do distrato
    }
  }

  return resultadoTransicao;
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
  destinatario: string;
  urlAssinatura: string;
}) {
  const { supabase, organizationId, contractId } = params;

  const { data: contrato } = await supabase
    .from("contratos")
    .select("objeto, pessoas ( nome_completo, email )")
    .eq("id", contractId)
    .maybeSingle<{
      objeto: string;
      pessoas: { nome_completo: string; email: string | null } | null;
    }>();

  if (!contrato?.pessoas) return;

  const baseUrl = process.env.APP_URL || "http://localhost:3000";
  const primeiroNome = contrato.pessoas.nome_completo.split(" ")[0];
  const { subject, html, text } = await renderizarEmailContratoEnviado({
    primeiroNome,
    objeto: contrato.objeto,
    urlContato: baseUrl,
    urlAssinatura: params.urlAssinatura,
  });

  // Chave determinística por contrato (Seção 6, regra 1) — "disparar contrato_enviado
  // duas vezes para o mesmo contrato envia um único e-mail": um segundo clique no
  // botão de envio já é bloqueado pela trava otimista da RPC (o contrato não está
  // mais em "emitido"), e mesmo que chegasse aqui, o índice único de
  // chave_idempotencia recusaria o segundo insert.
  return sendNotification({
    supabase,
    transport: transporteEmailPadrao(),
    organizationId,
    type: "contrato_enviado",
    recipientEmail: params.destinatario,
    entity: "contratos",
    entityId: contractId,
    idempotencyKey: `${idempotencyKey("contrato_enviado", contractId)}:${createHash("sha256").update(params.urlAssinatura).digest("hex").slice(0, 16)}`,
    subject,
    html,
    text,
  });
}

async function dispararDistratoEnviado(params: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  organizationId: string;
  contractId: string;
  destinatario: string;
  primeiroNome: string;
  objeto: string;
  dataDistrato: string;
  periodoTrabalhado: string;
  valorProporcional: string;
  motivo?: string;
}) {
  const { supabase, organizationId, contractId } = params;
  const baseUrl = process.env.APP_URL || "http://localhost:3000";

  const { subject, html, text } = await renderizarEmailDistratoEnviado({
    primeiroNome: params.primeiroNome,
    objeto: params.objeto,
    dataDistrato: params.dataDistrato,
    periodoTrabalhado: params.periodoTrabalhado,
    valorProporcional: params.valorProporcional,
    motivo: params.motivo,
    urlContato: baseUrl,
  });

  return sendNotification({
    supabase,
    transport: transporteEmailPadrao(),
    organizationId,
    type: "distrato_enviado",
    recipientEmail: params.destinatario,
    entity: "contratos",
    entityId: contractId,
    idempotencyKey: idempotencyKey("distrato_enviado", contractId),
    subject,
    html,
    text,
  });
}

export async function enviarDistratoPorEmail(contractId: string): Promise<ResultadoAcaoContrato> {
  const supabase = await createClient();
  const { organizationId, papel } = await obterContextoUsuario(supabase);
  if (!organizationId) return { ok: false, mensagem: "Sessão inválida — faça login novamente." };
  if (!PAPEIS_CONTRATO.includes(papel ?? "")) return { ok: false, mensagem: RECUSA_PAPEL_CONTRATO };

  const { data: contrato } = await supabase
    .from("contratos")
    .select("status, objeto, valor, vigencia_inicio, vigencia_fim, pessoas ( nome_completo, email )")
    .eq("id", contractId)
    .maybeSingle<{
      status: string;
      objeto: string;
      valor: string;
      vigencia_inicio: string;
      vigencia_fim: string;
      pessoas: { nome_completo: string; email: string | null } | null;
    }>();

  if (!contrato || (contrato.status !== "distratado" && contrato.status !== "distrato_assinado")) {
    return { ok: false, mensagem: "Contrato não encontrado ou não está em estado de distrato." };
  }

  if (!contrato.pessoas?.email) {
    return { ok: false, mensagem: "O integrante não possui endereço de e-mail cadastrado." };
  }

  const { data: eventos } = await supabase
    .from("eventos_contrato")
    .select("observacao, criado_em")
    .eq("contrato_id", contractId)
    .eq("status_novo", "distratado")
    .order("criado_em", { ascending: false })
    .limit(1);

  const observacao = eventos?.[0]?.observacao ?? "";
  const dataDistrato = eventos?.[0]?.criado_em
    ? formatarDataBR(eventos[0].criado_em.split("T")[0])
    : formatarDataBR(new Date().toISOString().split("T")[0]);

  try {
    const envio = await dispararDistratoEnviado({
      supabase,
      organizationId,
      contractId,
      destinatario: contrato.pessoas.email,
      primeiroNome: contrato.pessoas.nome_completo.split(" ")[0],
      objeto: contrato.objeto,
      dataDistrato,
      periodoTrabalhado: "Conforme apurado no termo de rescisão",
      valorProporcional: "Conforme termo de rescisão",
      motivo: observacao,
    });

    return envio?.sent
      ? { ok: true, mensagem: "Notificação de distrato enviada por e-mail." }
      : {
          ok: false,
          mensagem:
            envio?.reason === "duplicate"
              ? "Este envio de distrato já foi registrado anteriormente."
              : "Falha ao enviar a notificação de distrato por e-mail.",
        };
  } catch {
    return { ok: false, mensagem: "Erro ao disparar e-mail de distrato." };
  }
}

export async function gerarUrlPdfContrato(
  contractId: string,
  versao: "gerado" | "assinado" | "distrato" = "gerado",
): Promise<{ ok: boolean; url?: string; urlDownload?: string; nomeArquivo?: string; texto?: string; mensagem?: string }> {
  const supabase = await createClient();
  const { organizationId, userId } = await obterContextoUsuario(supabase);
  if (!organizationId) return { ok: false, mensagem: "Sessão inválida — faça login novamente." };

  if (versao === "gerado") {
    try {
      await garantirPdfCompleto(supabase, contractId);
    } catch (erro) {
      return {
        ok: false,
        mensagem: erro instanceof Error ? erro.message : "Não foi possível gerar o termo.",
      };
    }
  }
  const { data: contrato } = await supabase
    .from("contratos")
    .select("caminho_pdf, caminho_pdf_assinado, caminho_termo_distrato, pessoas(nome_completo)")
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
    const pessoa = Array.isArray(contrato?.pessoas) ? contrato.pessoas[0] : contrato?.pessoas;
    const nomeArquivo = nomeArquivoContrato(pessoa?.nome_completo, contractId, versao);
    const url = await criarUrlAssinada({
      supabase,
      bucket: "contratos",
      caminho,
      documentId: contractId,
      organizationId,
      userId,
    });
    // O visualizador continua inline; só a ação Baixar pede Content-Disposition attachment.
    const download = new URL(url);
    download.searchParams.set("download", nomeArquivo);
    let texto: string | undefined;
    if (versao === "gerado") {
      const { data: arquivo } = await supabase.storage.from("contratos").download(caminho);
      if (arquivo) texto = (await PDFDocument.load(await arquivo.arrayBuffer())).getSubject();
    }
    return { ok: true, url, urlDownload: download.href, nomeArquivo, texto };
  } catch {
    return { ok: false, mensagem: "Não foi possível gerar o link de acesso ao PDF." };
  }
}

export async function carregarPessoasParaEmissao() {
  try {
    return { ok: true as const, pessoas: await listarPessoasAptasSemContratoAtivo() };
  } catch {
    return { ok: false as const, mensagem: "Não foi possível carregar as pessoas aptas." };
  }
}

export async function prepararLinkAssinatura(
  contractId: string,
): Promise<{ ok: boolean; url?: string; mensagem?: string }> {
  const supabase = await createClient();
  const { organizationId, papel } = await obterContextoUsuario(supabase);
  if (!organizationId || !PAPEIS_CONTRATO.includes(papel ?? ""))
    return { ok: false, mensagem: RECUSA_PAPEL_CONTRATO };
  const { data: c } = await supabase
    .from("contratos")
    .select("status,token_assinatura,assinatura_expira_em,pessoa_id,pessoas(apta)")
    .eq("id", contractId)
    .single();
  if (!c || !["emitido", "enviado"].includes(c.status))
    return { ok: false, mensagem: "O contrato precisa estar emitido ou enviado." };

  const pessoaContrato = Array.isArray(c.pessoas) ? c.pessoas[0] : c.pessoas;
  if (!pessoaContrato?.apta) {
    return {
      ok: false,
      mensagem:
        "O contrato não pode mudar para 'enviado' pois o colaborador ainda não possui ambos os documentos (Identidade e Residência) aprovados.",
    };
  }
  try {
    await garantirPdfCompleto(supabase, contractId);
  } catch (erro) {
    return {
      ok: false,
      mensagem: erro instanceof Error ? erro.message : "Não foi possível preparar o PDF.",
    };
  }
  let token = c.token_assinatura as string | null;
  if (
    !token ||
    !c.assinatura_expira_em ||
    new Date(c.assinatura_expira_em).getTime() <= Date.now()
  ) {
    token = randomBytes(24).toString("hex");
    let update = supabase
      .from("contratos")
      .update({
        token_assinatura: token,
        assinatura_expira_em: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .eq("id", contractId)
      .in("status", ["emitido", "enviado"]);
    update = c.token_assinatura
      ? update.eq("token_assinatura", c.token_assinatura)
      : update.is("token_assinatura", null);
    const { data: gravado, error } = await update.select("id").maybeSingle();
    if (error || !gravado)
      return { ok: false, mensagem: "O contrato mudou. Tente preparar o link novamente." };
  }
  if (c.status === "emitido") {
    const transicao = await transicionarContrato({
      contractId,
      de: "emitido",
      para: "enviado",
      observacao: "Link de assinatura preparado para compartilhamento.",
    });
    if (!transicao.ok) return transicao;
  }
  revalidatePath("/contratos");
  return { ok: true, url: `/assinar/${token}` };
}

/**
 * Exclui o contrato do painel, apagando o registro das listas ativas/distratos
 * para não confundir o administrador, e arquiva o snapshot integral do contrato,
 * pessoa e eventos na tabela DadosExcluidos (dados_excluidos) com nome e login
 * de quem executou a exclusão.
 */
export async function excluirContrato(
  contractId: string,
  motivo?: string,
): Promise<ResultadoAcaoContrato> {
  const supabase = await createClient();
  const { organizationId, papel } = await obterContextoUsuario(supabase);
  if (!organizationId) return { ok: false, mensagem: "Sessão inválida — faça login novamente." };
  if (!PAPEIS_CONTRATO.includes(papel ?? "")) return { ok: false, mensagem: RECUSA_PAPEL_CONTRATO };

  const { error } = await supabase.rpc("excluir_contrato", {
    p_contrato_id: contractId,
    p_motivo: motivo?.trim() || null,
  });

  if (error) {
    return {
      ok: false,
      mensagem: error.message || "Não foi possível excluir o contratado.",
    };
  }

  revalidatePath("/contratos");
  revalidatePath("/dashboard");
  return {
    ok: true,
    mensagem: "Contratado excluído do painel e arquivado em DadosExcluidos com sucesso.",
  };
}
