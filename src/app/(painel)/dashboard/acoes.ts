/**
 * Server Actions do dashboard — Fase 3, item 7 (exportação) e o passo final do
 * detalhamento progressivo (abrir o documento/contrato a partir da lista
 * nominal). Exportações voltam como base64: Server Actions serializam o
 * retorno como JSON sobre o RSC, não aceitam `Buffer`/`Uint8Array` cru — o
 * cliente decodifica e monta o `Blob` para download.
 */
"use server";

import { createClient } from "@/lib/supabase/server";
import { obterContextoUsuario } from "@/lib/supabase/contexto-usuario";
import { criarUrlAssinada } from "@/lib/documentos/url-assinada";
import { buscarDadosDashboard } from "./dados";
import { gerarPdfRelatorio } from "@/lib/dashboard/gerar-relatorio";
import { gerarXlsxNominal } from "@/lib/dashboard/gerar-planilha";

export interface ResultadoExportacao {
  ok: boolean;
  base64?: string;
  nomeArquivo?: string;
  mensagem?: string;
}

export async function exportarRelatorioPdf(): Promise<ResultadoExportacao> {
  const supabase = await createClient();
  const { organizationId } = await obterContextoUsuario(supabase);
  if (!organizationId) return { ok: false, mensagem: "Sessão inválida — faça login novamente." };

  const { data: organizacao } = await supabase
    .from("organizacoes")
    .select("nome")
    .eq("id", organizationId)
    .single();

  const dados = await buscarDadosDashboard();
  const bytes = await gerarPdfRelatorio({
    organizacaoNome: organizacao?.nome ?? "Comitê Digital",
    geradoEm: new Date(),
    funil: dados.funil,
    matriz: dados.matriz,
    regioes: dados.regioes,
  });

  return {
    ok: true,
    base64: Buffer.from(bytes).toString("base64"),
    nomeArquivo: `relatorio-${new Date().toISOString().slice(0, 10)}.pdf`,
  };
}

export async function exportarBaseNominalXlsx(): Promise<ResultadoExportacao> {
  const dados = await buscarDadosDashboard();
  const bytes = await gerarXlsxNominal(dados.pessoas);

  return {
    ok: true,
    base64: Buffer.from(bytes).toString("base64"),
    nomeArquivo: `base-nominal-${new Date().toISOString().slice(0, 10)}.xlsx`,
  };
}

/** Último clique do detalhamento progressivo (item 3): abre o documento ou o
 * PDF do contrato mais recente de uma pessoa, a partir da lista nominal. */
export async function gerarUrlParaDrillDown(params: {
  documentoId?: string | null;
  contratoId?: string | null;
}): Promise<{ ok: boolean; url?: string; mensagem?: string }> {
  const supabase = await createClient();
  const { organizationId, userId } = await obterContextoUsuario(supabase);
  if (!organizationId) return { ok: false, mensagem: "Sessão inválida — faça login novamente." };

  if (params.documentoId) {
    const { data: documento } = await supabase
      .from("documentos")
      .select("caminho_storage")
      .eq("id", params.documentoId)
      .maybeSingle();
    if (!documento) return { ok: false, mensagem: "Documento não encontrado." };

    try {
      const url = await criarUrlAssinada({
        supabase,
        bucket: "documentos",
        caminho: documento.caminho_storage,
        documentId: params.documentoId,
        organizationId,
        userId,
      });
      return { ok: true, url };
    } catch {
      return { ok: false, mensagem: "Não foi possível gerar o link do documento." };
    }
  }

  if (params.contratoId) {
    const { data: contrato } = await supabase
      .from("contratos")
      .select("caminho_pdf")
      .eq("id", params.contratoId)
      .maybeSingle();
    if (!contrato?.caminho_pdf) return { ok: false, mensagem: "Este contrato ainda não tem PDF." };

    try {
      const url = await criarUrlAssinada({
        supabase,
        bucket: "contratos",
        caminho: contrato.caminho_pdf,
        documentId: params.contratoId,
        organizationId,
        userId,
      });
      return { ok: true, url };
    } catch {
      return { ok: false, mensagem: "Não foi possível gerar o link do contrato." };
    }
  }

  return { ok: false, mensagem: "Esta pessoa ainda não tem documento nem contrato para abrir." };
}
