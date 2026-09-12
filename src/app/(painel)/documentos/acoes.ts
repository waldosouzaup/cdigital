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
import {
  calcularHashSha256,
  extensaoPorMime,
  validarDimensaoImagem,
  validarTipoETamanho,
} from "@/lib/documentos/upload";

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

// Trava de papel (migration 0016 / 0023): aprovar/rejeitar/gerenciar documento é exclusivo de gestor,
// coord_comite e superadmin.
const PAPEIS_TRIAGEM = ["gestor", "coord_comite", "superadmin"];
const RECUSA_PAPEL = "Só gestores, coordenadores de comitê ou superadministradores podem validar ou alterar documentos.";

function formatarValorBRL(valor: number): string {
  return `R$ ${valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatarDataBR(isoDate: string): string {
  const [ano, mes, dia] = isoDate.split("-");
  return `${dia}/${mes}/${ano}`;
}

export async function aprovarDocumentoEGerarContrato(
  documentoId: string,
  /**
   * Vencimento do documento no formato ISO (migration 0040). Opcional: a maioria
   * não vence. Data passada é recusada — aprovar como válido algo já vencido
   * seria registrar uma conformidade que não existe.
   */
  validoAte?: string | null,
): Promise<ResultadoAcaoDocumento> {
  const supabase = await createClient();
  const { organizationId, userId, papel } = await obterContextoUsuario(supabase);
  if (!organizationId) return { ok: false, mensagem: "Sessão inválida — faça login novamente." };
  if (!PAPEIS_TRIAGEM.includes(papel ?? "")) return { ok: false, mensagem: RECUSA_PAPEL };

  const validade = (validoAte ?? "").trim();
  if (validade) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(validade)) {
      return { ok: false, mensagem: "Data de validade inválida." };
    }
    const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(
      new Date(),
    );
    if (validade < hoje) {
      return {
        ok: false,
        mensagem: "A validade informada já passou. Peça um documento dentro do prazo.",
      };
    }
  }

  // 1. Aprova o documento
  const { data: documento, error: erroDoc } = await supabase
    .from("documentos")
    .update({ status: "aprovado", motivo_rejeicao: null, valido_ate: validade || null })
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
    .select("id, nome_completo, cpf, endereco, chave_pix, funcao, email, telefone, banco, agencia, conta, regiao_id")
    .eq("id", documento.pessoa_id)
    .single();

  if (!pessoa) {
    revalidatePath("/documentos");
    return { ok: true, pessoaFicouApta, mensagem: "Documento aprovado." };
  }

  // REGRA FUNDAMENTAL DE NEGÓCIO:
  // Um contrato só pode ser gerado e mudar para o status 'enviado' após a conferência e aprovação de AMBOS os documentos:
  // 1. Documento de Identificação (RG/CNH)
  // 2. Comprovante de Residência
  // Se apenas um documento for aprovado e o outro não (pendente, rejeitado ou ausente),
  // o sistema NUNCA gera nem envia o contrato, pois ambas as condições precisam ser verdadeiras.
  if (!pessoaFicouApta) {
    revalidatePath("/documentos");
    revalidatePath("/pessoas");
    return {
      ok: true,
      pessoaFicouApta: false,
      pessoaNome: pessoa.nome_completo,
      mensagem:
        "Documento aprovado com sucesso. O contrato NÃO foi gerado nem enviado pois aguarda a conferência e aprovação de ambos os documentos obrigatórios (Identidade e Comprovante de Residência).",
    };
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

  // 5. Verifica se a pessoa já possui um contrato ativo
  const { data: contratoExistente } = await supabase
    .from("contratos")
    .select("id, status, token_assinatura, assinatura_expira_em, objeto, caminho_pdf, pdf_sha256")
    .eq("pessoa_id", pessoa.id)
    .order("criado_em", { ascending: false })
    .limit(1)
    .maybeSingle();

  const expiracao = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  let contratoId = contratoExistente?.id;
  let tokenAssinatura = contratoExistente?.token_assinatura;
  let objetoContrato = contratoExistente?.objeto ?? templateEscolhido.objeto;

  if (!contratoExistente || ["rascunho", "emitido"].includes(contratoExistente.status)) {
    const valor =
      templateEscolhido.valor_padrao && Number(templateEscolhido.valor_padrao) > 0
        ? Number(templateEscolhido.valor_padrao)
        : 3553;
    const valorExtenso = amountInWords(valor);
    const vigenciaInicio = "2026-09-01";
    const vigenciaFim = "2026-10-03";
    const tokenNovo = randomBytes(24).toString("hex");

    // Renderiza e compila o PDF oficial do contrato
    const corpoComDados = substituirMarcadores(templateEscolhido.corpo_html, {
      nome: pessoa.nome_completo,
      cpf: pessoa.cpf,
      endereco: pessoa.endereco ?? "não informado",
      chavePix: pessoa.chave_pix ?? "não informada",
      email: pessoa.email ?? "não informado",
      telefone: pessoa.telefone ?? "não informado",
      banco: pessoa.banco ?? "não informado",
      agencia: pessoa.agencia ?? "não informada",
      conta: pessoa.conta ?? "não informada",
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

    const hashPdf = calcularHashSha256(Buffer.from(pdfBytes));

    if (!contratoExistente) {
      const { data: contratoNovo, error: erroInsercaoContrato } = await supabase
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
          token_assinatura: tokenNovo,
          assinatura_expira_em: expiracao,
          pdf_sha256: hashPdf,
          regiao_id: pessoa.regiao_id,
        })
        .select("id")
        .single();

      if (erroInsercaoContrato || !contratoNovo) {
        revalidatePath("/documentos");
        return {
          ok: true,
          pessoaFicouApta,
          pessoaNome: pessoa.nome_completo,
          mensagem: "Documento aprovado, mas ocorreu um erro ao gerar o registro de contrato.",
        };
      }

      contratoId = contratoNovo.id;
      tokenAssinatura = tokenNovo;
      objetoContrato = templateEscolhido.objeto;

      const pdfPath = `${organizationId}/${pessoa.id}/contrato_${contratoId}.pdf`;
      await supabase.storage
        .from("contratos")
        .upload(pdfPath, pdfBytes, { contentType: "application/pdf", upsert: true });

      await supabase.from("contratos").update({ caminho_pdf: pdfPath }).eq("id", contratoId);

      await supabase.rpc("gravar_transicao_contrato", {
        p_contrato_id: contratoId,
        p_status_anterior: "rascunho",
        p_status_novo: "emitido",
        p_observacao: "Emissão automática após aprovação na mesa de conferência documental.",
      });

      await supabase
        .from("contratos")
        .update({
          canal_envio: "email",
          enviado_para: pessoa.email ?? "sem-email-cadastrado",
        })
        .eq("id", contratoId);

      await supabase.rpc("gravar_transicao_contrato", {
        p_contrato_id: contratoId,
        p_status_anterior: "emitido",
        p_status_novo: "enviado",
        p_observacao: `Contrato disponibilizado para assinatura pública via link.${pessoa.email ? ` Notificação despachada para ${pessoa.email}.` : ""}`,
      });

      await registerContractWrite({
        supabase,
        organizationId,
        userId,
        contractId: contratoId,
        action: "emissao",
      });
    } else {
      // Contrato em rascunho/emitido: atualiza PDF, hash, token e expiração
      contratoId = contratoExistente.id;
      tokenAssinatura = contratoExistente.token_assinatura || tokenNovo;
      objetoContrato = contratoExistente.objeto;

      const pdfPath = `${organizationId}/${pessoa.id}/contrato_${contratoId}.pdf`;
      await supabase.storage
        .from("contratos")
        .upload(pdfPath, pdfBytes, { contentType: "application/pdf", upsert: true });

      await supabase
        .from("contratos")
        .update({
          caminho_pdf: pdfPath,
          pdf_sha256: hashPdf,
          token_assinatura: tokenAssinatura,
          assinatura_expira_em: expiracao,
        })
        .eq("id", contratoId);

      if (contratoExistente.status === "rascunho") {
        await supabase.rpc("gravar_transicao_contrato", {
          p_contrato_id: contratoId,
          p_status_anterior: "rascunho",
          p_status_novo: "emitido",
          p_observacao: "Emissão após aprovação documental.",
        });
      }

      await supabase.rpc("gravar_transicao_contrato", {
        p_contrato_id: contratoId,
        p_status_anterior: "emitido",
        p_status_novo: "enviado",
        p_observacao: "Contrato enviado para assinatura após aprovação documental.",
      });
    }
  } else if (contratoExistente.status === "enviado") {
    // Contrato já enviado: renova a expiração se expirado
    contratoId = contratoExistente.id;
    tokenAssinatura = contratoExistente.token_assinatura;
    objetoContrato = contratoExistente.objeto;

    if (
      !tokenAssinatura ||
      !contratoExistente.assinatura_expira_em ||
      new Date(contratoExistente.assinatura_expira_em).getTime() <= Date.now()
    ) {
      tokenAssinatura = randomBytes(24).toString("hex");
      await supabase
        .from("contratos")
        .update({
          token_assinatura: tokenAssinatura,
          assinatura_expira_em: expiracao,
        })
        .eq("id", contratoId);
    }
  }

  // 6. Monta URL e dispara e-mail com link de assinatura para o colaborador
  const baseUrl = process.env.APP_URL || "http://localhost:3000";
  const urlAssinatura = `${baseUrl}/assinar/${tokenAssinatura}`;
  let emailEnviado = false;

  if (pessoa.email && contratoId && tokenAssinatura) {
    const primeiroNome = pessoa.nome_completo.split(" ")[0];
    const { subject, html, text } = await renderizarEmailContratoEnviado({
      primeiroNome,
      objeto: objetoContrato,
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
      entityId: contratoId,
      idempotencyKey: `${idempotencyKey("contrato_enviado", contratoId)}:${tokenAssinatura.slice(0, 16)}`,
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
    contratoId,
    tokenAssinatura,
    urlAssinatura,
    emailEnviado,
    destinatarioEmail: pessoa.email,
    pessoaNome: pessoa.nome_completo,
    mensagem: emailEnviado
      ? `Documento aprovado! Contrato emitido e link de assinatura enviado por e-mail para ${pessoa.email}.`
      : pessoa.email
        ? `Documento aprovado e contrato gerado em PDF! Link de assinatura pronto para compartilhamento.`
        : `Documento aprovado e contrato gerado em PDF! (Colaborador sem e-mail cadastrado — copie o link de assinatura).`,
  };
}

export async function aprovarDocumento(
  documentoId: string,
  validoAte?: string | null,
): Promise<ResultadoAcaoDocumento> {
  return aprovarDocumentoEGerarContrato(documentoId, validoAte);
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

/**
 * Marca um documento de volta para "pendente" (reabre a conferência).
 * Se o documento estava aprovado, revoga a aptidão do colaborador até nova decisão.
 */
export async function marcarDocumentoPendente(
  documentoId: string,
): Promise<ResultadoAcaoDocumento> {
  const supabase = await createClient();
  const { organizationId, userId, papel } = await obterContextoUsuario(supabase);
  if (!organizationId) return { ok: false, mensagem: "Sessão inválida — faça login novamente." };
  if (!PAPEIS_TRIAGEM.includes(papel ?? "")) return { ok: false, mensagem: RECUSA_PAPEL };

  const { data: documento, error } = await supabase
    .from("documentos")
    .update({ status: "pendente", motivo_rejeicao: null })
    .eq("id", documentoId)
    .select("id, pessoa_id, status")
    .single();

  if (error || !documento) {
    return { ok: false, mensagem: "Não foi possível marcar o documento como pendente." };
  }

  await registerDocumentReview({
    supabase,
    organizationId,
    userId,
    documentId: documento.id,
    action: "reabertura",
  });

  const pessoaFicouApta = await reavaliarAptidao({
    supabase,
    organizationId,
    userId,
    pessoaId: documento.pessoa_id,
  });

  revalidatePath("/documentos");
  revalidatePath("/pessoas");
  revalidatePath("/dashboard");
  return {
    ok: true,
    pessoaFicouApta,
    mensagem: "Documento reaberto e marcado como pendente para conferência.",
  };
}

/**
 * Upload manual de documento realizado pelo gestor ou administrador diretamente pelo painel.
 */
export async function adicionarDocumentoManual(
  formData: FormData,
): Promise<ResultadoAcaoDocumento> {
  const supabase = await createClient();
  const { organizationId, userId, papel } = await obterContextoUsuario(supabase);
  if (!organizationId) return { ok: false, mensagem: "Sessão inválida — faça login novamente." };
  if (!PAPEIS_TRIAGEM.includes(papel ?? "")) return { ok: false, mensagem: RECUSA_PAPEL };

  const pessoaId = String(formData.get("pessoaId") ?? "").trim();
  const tipoParam = String(formData.get("tipo") ?? "").trim();
  const statusInicial = String(formData.get("statusInicial") ?? "pendente").trim();
  const arquivo = formData.get("arquivo");

  if (!pessoaId) {
    return { ok: false, mensagem: "Selecione o colaborador para o envio do documento." };
  }
  if (!["documento_identidade", "comprovante_endereco"].includes(tipoParam)) {
    return { ok: false, mensagem: "Selecione um tipo de documento válido." };
  }
  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return { ok: false, mensagem: "Selecione um arquivo válido para enviar." };
  }

  const checagemTipo = validarTipoETamanho(arquivo.type, arquivo.size);
  if (!checagemTipo.ok) {
    return { ok: false, mensagem: checagemTipo.motivo ?? "Arquivo inválido." };
  }

  const buffer = Buffer.from(await arquivo.arrayBuffer());
  const checagemDimensao = await validarDimensaoImagem(buffer, arquivo.type);
  if (!checagemDimensao.ok) {
    return { ok: false, mensagem: checagemDimensao.motivo ?? "Resolução de imagem baixa." };
  }

  const hash = calcularHashSha256(buffer);
  const ext = extensaoPorMime(arquivo.type);
  if (!ext) {
    return { ok: false, mensagem: "Tipo de arquivo não suportado." };
  }

  // Verifica se o hash já existe na organização
  const { data: existente } = await supabase
    .from("documentos")
    .select("id, criado_em")
    .eq("hash_sha256", hash)
    .maybeSingle();

  if (existente) {
    return {
      ok: false,
      mensagem: "Este mesmo arquivo já foi cadastrado anteriormente no sistema.",
    };
  }

  // Busca dados da pessoa para obter regiao_id
  const { data: pessoa } = await supabase
    .from("pessoas")
    .select("id, nome_completo, regiao_id")
    .eq("id", pessoaId)
    .maybeSingle();

  if (!pessoa) {
    return { ok: false, mensagem: "Colaborador não encontrado." };
  }

  // Calcula próxima versão
  const { data: ultimos } = await supabase
    .from("documentos")
    .select("versao")
    .eq("pessoa_id", pessoaId)
    .eq("tipo", tipoParam)
    .order("versao", { ascending: false })
    .limit(1);

  const versao = (ultimos?.[0]?.versao ?? 0) + 1;
  const caminhoStorage = `${organizationId}/${pessoaId}/${tipoParam}_v${versao}.${ext}`;

  // Upload para storage
  const { error: erroUpload } = await supabase.storage
    .from("documentos")
    .upload(caminhoStorage, buffer, { contentType: arquivo.type, upsert: true });

  if (erroUpload) {
    console.error("Erro no upload do documento para storage:", erroUpload);
    return { ok: false, mensagem: "Não foi possível salvar o arquivo no Storage." };
  }

  // Insere em documentos
  const { data: novoDoc, error: erroInsert } = await supabase
    .from("documentos")
    .insert({
      organizacao_id: organizationId,
      pessoa_id: pessoaId,
      regiao_id: pessoa.regiao_id,
      tipo: tipoParam,
      nome_original: arquivo.name,
      caminho_storage: caminhoStorage,
      hash_sha256: hash,
      largura_px: checagemDimensao.largura ?? null,
      altura_px: checagemDimensao.altura ?? null,
      bytes: arquivo.size,
      status: statusInicial === "aprovado" ? "aprovado" : "pendente",
      versao,
    })
    .select("id")
    .single();

  if (erroInsert || !novoDoc) {
    console.error("Erro ao inserir documento:", erroInsert);
    return { ok: false, mensagem: "Não foi possível registrar o documento." };
  }

  await registerPersonWrite({
    supabase,
    organizationId,
    userId,
    personId: pessoaId,
    action: "edicao",
  });

  if (statusInicial === "aprovado") {
    return aprovarDocumentoEGerarContrato(novoDoc.id);
  }

  revalidatePath("/documentos");
  revalidatePath("/pessoas");
  revalidatePath("/dashboard");

  return {
    ok: true,
    mensagem: `Documento v${versao} de ${pessoa.nome_completo} adicionado com sucesso.`,
  };
}

/**
 * Edição de documento: permite corrigir o tipo (ex: RG para Comprovante), motivo de rejeição
 * e opcionalmente anexar arquivo substituto.
 */
export async function editarDocumento(
  formData: FormData,
): Promise<ResultadoAcaoDocumento> {
  const supabase = await createClient();
  const { organizationId, userId, papel } = await obterContextoUsuario(supabase);
  if (!organizationId) return { ok: false, mensagem: "Sessão inválida — faça login novamente." };
  if (!PAPEIS_TRIAGEM.includes(papel ?? "")) return { ok: false, mensagem: RECUSA_PAPEL };

  const id = String(formData.get("id") ?? "").trim();
  const novoTipo = String(formData.get("tipo") ?? "").trim();
  const novoMotivo = String(formData.get("motivoRejeicao") ?? "").trim();
  const arquivoSubstituto = formData.get("arquivo");

  if (!id) return { ok: false, mensagem: "Documento não informado." };

  const { data: docAtual } = await supabase
    .from("documentos")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!docAtual) return { ok: false, mensagem: "Documento não encontrado." };

  const updates: Record<string, unknown> = {};
  if (novoTipo && ["documento_identidade", "comprovante_endereco"].includes(novoTipo)) {
    updates.tipo = novoTipo;
  }
  if (docAtual.status === "rejeitado") {
    updates.motivo_rejeicao = novoMotivo || docAtual.motivo_rejeicao;
  }

  // Se houver arquivo substituto anexado
  if (arquivoSubstituto instanceof File && arquivoSubstituto.size > 0) {
    const checagemTipo = validarTipoETamanho(arquivoSubstituto.type, arquivoSubstituto.size);
    if (!checagemTipo.ok) {
      return { ok: false, mensagem: checagemTipo.motivo ?? "Arquivo inválido." };
    }

    const buffer = Buffer.from(await arquivoSubstituto.arrayBuffer());
    const checagemDimensao = await validarDimensaoImagem(buffer, arquivoSubstituto.type);
    if (!checagemDimensao.ok) {
      return { ok: false, mensagem: checagemDimensao.motivo ?? "Resolução de imagem baixa." };
    }

    const hash = calcularHashSha256(buffer);
    const ext = extensaoPorMime(arquivoSubstituto.type);
    const novaVersao = docAtual.versao + 1;
    const tipoFinal = (updates.tipo as string) || docAtual.tipo;
    const novoCaminho = `${organizationId}/${docAtual.pessoa_id}/${tipoFinal}_v${novaVersao}.${ext}`;

    const { error: erroUpload } = await supabase.storage
      .from("documentos")
      .upload(novoCaminho, buffer, { contentType: arquivoSubstituto.type, upsert: true });

    if (erroUpload) {
      return { ok: false, mensagem: "Não foi possível fazer upload do novo arquivo." };
    }

    updates.caminho_storage = novoCaminho;
    updates.nome_original = arquivoSubstituto.name;
    updates.hash_sha256 = hash;
    updates.largura_px = checagemDimensao.largura ?? null;
    updates.altura_px = checagemDimensao.altura ?? null;
    updates.bytes = arquivoSubstituto.size;
    updates.versao = novaVersao;
  }

  if (Object.keys(updates).length > 0) {
    const { error: erroUpdate } = await supabase
      .from("documentos")
      .update(updates)
      .eq("id", id);

    if (erroUpdate) {
      return { ok: false, mensagem: "Não foi possível atualizar o documento." };
    }
  }

  const pessoaFicouApta = await reavaliarAptidao({
    supabase,
    organizationId,
    userId,
    pessoaId: docAtual.pessoa_id,
  });

  revalidatePath("/documentos");
  revalidatePath("/pessoas");
  revalidatePath("/dashboard");

  return { ok: true, pessoaFicouApta, mensagem: "Documento atualizado com sucesso." };
}

/**
 * Exclui o documento do painel e do Storage, arquivando snapshot de auditoria em DadosExcluidos
 * e recalculando a aptidão do colaborador.
 */
export async function excluirDocumento(
  documentoId: string,
  motivo?: string,
): Promise<ResultadoAcaoDocumento> {
  const supabase = await createClient();
  const { organizationId, userId, papel } = await obterContextoUsuario(supabase);
  if (!organizationId) return { ok: false, mensagem: "Sessão inválida — faça login novamente." };
  if (!PAPEIS_TRIAGEM.includes(papel ?? "")) return { ok: false, mensagem: RECUSA_PAPEL };

  const { data: resultado, error } = await supabase.rpc("excluir_documento", {
    p_documento_id: documentoId,
    p_motivo: motivo?.trim() || null,
  });

  if (error || !resultado?.ok) {
    return {
      ok: false,
      mensagem: error?.message || "Não foi possível excluir o documento.",
    };
  }

  // Remove o arquivo do Storage
  if (resultado.caminho_storage) {
    const { error: erroStorage } = await supabase.storage
      .from("documentos")
      .remove([resultado.caminho_storage]);
    if (erroStorage) {
      console.warn("Documento excluído da base, falha ao remover arquivo no Storage:", erroStorage.message);
    }
  }

  // Reavalia aptidão da pessoa (se este era o documento aprovado, revoga aptidão)
  const pessoaFicouApta = await reavaliarAptidao({
    supabase,
    organizationId,
    userId,
    pessoaId: resultado.pessoa_id,
  });

  revalidatePath("/documentos");
  revalidatePath("/pessoas");
  revalidatePath("/contratos");
  revalidatePath("/dashboard");

  return {
    ok: true,
    pessoaFicouApta,
    mensagem: `Documento de ${resultado.pessoa_nome ?? "colaborador"} excluído e arquivado em DadosExcluidos com sucesso.`,
  };
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
