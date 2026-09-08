/**
 * Leitura de contratos e das listas auxiliares (pessoas aptas sem contrato ativo,
 * templates ativos) para a tela de emissão — Fase 2, itens 8/10/11.
 */
import { createClient } from "@/lib/supabase/server";
import { ACTIVE_BOARD_STATUSES, type ContractStatus } from "@/lib/contratos/maquina-estados";

export interface ContratoListado {
  id: string;
  pessoaId: string;
  pessoaNome: string;
  pessoaCpf: string;
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
  pessoas: { nome_completo: string; cpf: string } | null;
  regioes: { nome: string } | null;
}

const SELECAO_CONTRATO =
  "id, pessoa_id, objeto, valor, valor_extenso, vigencia_inicio, vigencia_fim, status, canal_envio, enviado_para, caminho_pdf, caminho_pdf_assinado, pessoas ( nome_completo, cpf ), regioes ( nome )";

export async function listarContratos(): Promise<ContratoListado[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contratos")
    .select(SELECAO_CONTRATO)
    .order("criado_em", { ascending: false })
    .returns<LinhaContrato[]>();

  if (error) throw new Error("Não foi possível carregar os contratos.");

  return (data ?? []).map((linha) => ({
    id: linha.id,
    pessoaId: linha.pessoa_id,
    pessoaNome: linha.pessoas?.nome_completo ?? "—",
    pessoaCpf: linha.pessoas?.cpf ?? "—",
    objeto: linha.objeto,
    valor: linha.valor,
    valorExtenso: linha.valor_extenso,
    vigenciaInicio: linha.vigencia_inicio,
    vigenciaFim: linha.vigencia_fim,
    status: linha.status,
    regiaoNome: linha.regioes?.nome ?? null,
    canalEnvio: linha.canal_envio,
    enviadoPara: linha.enviado_para,
    pdfPath: linha.caminho_pdf,
    signedPdfPath: linha.caminho_pdf_assinado,
  }));
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

/**
 * Pessoas aptas que ainda não têm nenhum contrato "vivo" (qualquer estado que não
 * seja um encerramento — distrato/cancelado/encerrado não impede um novo contrato).
 * PostgREST não faz anti-join direto por aqui, então filtra em memória — volume
 * esperado (centenas, não milhões) não justifica RPC só para isto.
 */
export async function listarPessoasAptasSemContratoAtivo(): Promise<PessoaParaEmissao[]> {
  const supabase = await createClient();

  const [pessoasResp, contratosResp] = await Promise.all([
    supabase
      .from("pessoas")
      .select("id, nome_completo, cpf, endereco, regioes ( nome )")
      .eq("apta", true)
      .returns<
        { id: string; nome_completo: string; cpf: string; endereco: string | null; regioes: { nome: string } | null }[]
      >(),
    supabase
      .from("contratos")
      .select("pessoa_id, status")
      .returns<{ pessoa_id: string; status: ContractStatus }[]>(),
  ]);

  if (pessoasResp.error) throw new Error("Não foi possível carregar as pessoas aptas.");
  if (contratosResp.error) throw new Error("Não foi possível carregar os contratos existentes.");

  const statusQueBloqueiam = new Set<ContractStatus>(["rascunho", ...ACTIVE_BOARD_STATUSES]);
  const pessoasComContratoAtivo = new Set(
    (contratosResp.data ?? [])
      .filter((c) => statusQueBloqueiam.has(c.status))
      .map((c) => c.pessoa_id),
  );

  return (pessoasResp.data ?? [])
    .filter((p) => !pessoasComContratoAtivo.has(p.id))
    .map((p) => ({
      id: p.id,
      nomeCompleto: p.nome_completo,
      cpf: p.cpf,
      endereco: p.endereco,
      regiaoNome: p.regioes?.nome ?? null,
    }));
}
