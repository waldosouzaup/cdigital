/**
 * Leitura de contratos e das listas auxiliares (pessoas aptas sem contrato ativo,
 * templates ativos) para a tela de emissão — Fase 2, itens 8/10/11.
 */
import { createClient } from "@/lib/supabase/server";
import { type ContractStatus } from "@/lib/contratos/maquina-estados";

export interface ContratoListado {
  id: string;
  pessoaId: string;
  pessoaNome: string;
  pessoaCpf: string;
  pessoaEmail: string | null;
  pessoaTelefone: string | null;
  objeto: string;
  valor: string;
  valorExtenso: string;
  vigenciaInicio: string;
  vigenciaFim: string;
  status: ContractStatus;
  regiaoNome: string | null;
  canalEnvio: string | null;
  enviadoPara: string | null;
  pdfPath: string | null;
  signedPdfPath: string | null;
  distratoTermPath: string | null;
}

interface LinhaContrato {
  id: string;
  pessoa_id: string;
  objeto: string;
  valor: string;
  valor_extenso: string;
  vigencia_inicio: string;
  vigencia_fim: string;
  status: ContractStatus;
  canal_envio: string | null;
  enviado_para: string | null;
  caminho_pdf: string | null;
  caminho_pdf_assinado: string | null;
  caminho_termo_distrato: string | null;
  pessoas: {
    nome_completo: string;
    cpf: string;
    email: string | null;
    telefone: string | null;
  } | null;
  regioes: { nome: string } | null;
}

export interface FiltrosContratos {
  busca: string;
  status?: string;
  aba: "ativos" | "distratos";
  pagina: number;
  porPagina: number;
}

export interface PaginaContratos extends FiltrosContratos {
  contratos: ContratoListado[];
  totalAtivos: number;
  totalDistratos: number;
  total: number;
}

export async function listarContratos(filtros: FiltrosContratos): Promise<PaginaContratos> {
  const supabase = await createClient();
  const { data: resultado, error } = await supabase.rpc("buscar_contratos_paginados", {
    p_busca: filtros.busca,
    p_aba: filtros.aba,
    p_pagina: filtros.pagina,
    p_limite: filtros.porPagina,
    p_status: filtros.status || "",
  });
  if (error) throw new Error("Não foi possível carregar os contratos.");
  const data = resultado.itens as LinhaContrato[];
  const contratos = (data ?? []).map((linha) => ({
    id: linha.id,
    pessoaId: linha.pessoa_id,
    pessoaNome: linha.pessoas?.nome_completo ?? "—",
    pessoaCpf: linha.pessoas?.cpf ?? "—",
    pessoaEmail: linha.pessoas?.email ?? null,
    pessoaTelefone: linha.pessoas?.telefone ?? null,
    objeto: linha.objeto,
    valor: String(linha.valor),
    valorExtenso: linha.valor_extenso,
    vigenciaInicio: linha.vigencia_inicio,
    vigenciaFim: linha.vigencia_fim,
    status: linha.status,
    regiaoNome: linha.regioes?.nome ?? null,
    canalEnvio: linha.canal_envio,
    enviadoPara: linha.enviado_para,
    pdfPath: linha.caminho_pdf,
    signedPdfPath: linha.caminho_pdf_assinado,
    distratoTermPath: linha.caminho_termo_distrato,
  }));
  return {
    ...filtros,
    contratos,
    pagina: resultado.pagina,
    total: resultado.total,
    totalAtivos: resultado.ativos,
    totalDistratos: resultado.distratos,
  };
}

export interface TemplateParaEmissao {
  id: string;
  nome: string;
  objeto: string;
  corpoHtml: string;
  valorPadrao: string | null;
}

export async function listarTemplatesAtivos(): Promise<TemplateParaEmissao[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("templates_contrato")
    .select("id, nome, objeto, corpo_html, valor_padrao")
    .eq("ativo", true)
    .order("nome");

  if (error) throw new Error("Não foi possível carregar os modelos de contrato.");

  return (data ?? []).map((t) => ({
    id: t.id,
    nome: t.nome,
    objeto: t.objeto,
    corpoHtml: t.corpo_html,
    valorPadrao: t.valor_padrao,
  }));
}

export interface PessoaParaEmissao {
  id: string;
  nomeCompleto: string;
  cpf: string;
  endereco: string | null;
  regiaoNome: string | null;
}

/** Anti-join no banco; consultado somente ao abrir a emissão. */
export async function listarPessoasAptasSemContratoAtivo(): Promise<PessoaParaEmissao[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pessoas_aptas_para_contrato");
  if (error) throw new Error("Não foi possível carregar as pessoas aptas.");
  return data as PessoaParaEmissao[];
}
