import { createHash, randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { gerarPdfContrato, htmlParaTexto } from "./gerar-pdf";
import { substituirMarcadores } from "./marcadores";
import { nomeArquivoContrato } from "./nome-arquivo";

export const sha256 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

/** Congela o conteúdo ao preparar o primeiro PDF. Reaberturas usam os mesmos bytes. */
export async function garantirPdfCompleto(supabase: SupabaseClient, contratoId: string) {
  const { data: c, error } = await supabase
    .from("contratos")
    .select("*, pessoas(*), templates_contrato(corpo_html)")
    .eq("id", contratoId)
    .single();
  if (error || !c) throw new Error("Contrato não encontrado.");
  if (c.caminho_pdf && (c.pdf_sha256 || !["rascunho", "emitido", "enviado"].includes(c.status))) {
    return { caminho: c.caminho_pdf as string, hash: c.pdf_sha256 as string | null };
  }
  if (!["rascunho", "emitido", "enviado"].includes(c.status)) {
    throw new Error(
      "O PDF original deste contrato não foi arquivado. Solicite o documento à coordenação.",
    );
  }
  const corpo = c.templates_contrato?.corpo_html;
  if (!corpo || !corpo.includes("{{nome}}") || !corpo.includes("{{cpf}}")) {
    throw new Error(
      "O modelo está incompleto. Configure o texto integral com nome e CPF antes de gerar o contrato.",
    );
  }
  const p = c.pessoas;
  const dataBR = (v: string) => v.split("-").reverse().join("/");
  const preenchido = substituirMarcadores(htmlParaTexto(corpo), {
    nome: p.nome_completo,
    cpf: p.cpf,
    endereco: p.endereco ?? "não informado",
    objeto: c.objeto,
    objetoDescricao:
      c.objeto === "Administrativo e Montagem de Material"
        ? " (Apoio às atividades administrativas do comitê e montagem, organização e preparação de materiais de campanha para distribuição e utilização nas ações eleitorais.)"
        : "",
    valor: Number(c.valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
    valorExtenso: c.valor_extenso,
    vigenciaInicio: dataBR(c.vigencia_inicio),
    vigenciaFim: dataBR(c.vigencia_fim),
    chavePix: p.chave_pix ?? "não informada",
    email: p.email ?? "não informado",
    telefone: p.telefone ?? "não informado",
    banco: p.banco ?? "não informado",
    agencia: p.agencia ?? "não informada",
    conta: p.conta ?? "não informada",
  });
  if (/\{\{[^}]+\}\}/.test(preenchido))
    throw new Error(
      "O modelo contém campos sem preenchimento. Revise os marcadores em Configurações.",
    );
  const bytes = await gerarPdfContrato({
    titulo: "CONTRATO DE PRESTAÇÃO DE SERVIÇOS",
    corpo: preenchido,
  });
  const caminho = `${c.organizacao_id}/${c.pessoa_id}/${randomUUID()}/${nomeArquivoContrato(p.nome_completo, c.id)}`;
  const hash = sha256(bytes);
  const { error: uploadError } = await supabase.storage
    .from("contratos")
    .upload(caminho, bytes, { contentType: "application/pdf" });
  if (uploadError) throw new Error("Não foi possível arquivar o contrato preenchido.");
  const { data: gravado, error: saveError } = await supabase
    .from("contratos")
    .update({ caminho_pdf: caminho, pdf_sha256: hash })
    .eq("id", c.id)
    .is("pdf_sha256", null)
    .in("status", ["rascunho", "emitido", "enviado"])
    .select("id")
    .maybeSingle();
  if (saveError || !gravado) {
    await supabase.storage.from("contratos").remove([caminho]);
    if (saveError)
      throw new Error("Não foi possível guardar o documento. Verifique sua permissão.");
    const { data: atual } = await supabase
      .from("contratos")
      .select("caminho_pdf,pdf_sha256")
      .eq("id", c.id)
      .single();
    if (!atual?.caminho_pdf || !atual.pdf_sha256)
      throw new Error("O contrato mudou durante a geração. Recarregue a página.");
    return { caminho: atual.caminho_pdf as string, hash: atual.pdf_sha256 as string };
  }
  return { caminho, hash };
}
