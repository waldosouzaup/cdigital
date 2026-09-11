/**
 * Leitura de pessoas/regiões para a Fase 2 — sempre pelo cliente com RLS do usuário
 * (`server.ts`), nunca `admin.ts` (regra de ESLint em `eslint.config.mjs` já proíbe
 * isso dentro de `(painel)`). Isolamento por organização/região vem de graça da
 * policy — esta camada não filtra nada por conta própria.
 */
import { createClient } from "@/lib/supabase/server";
import { calcularPendencias, type Pendencia } from "@/lib/pessoas/pendencias";
import { calcularIdade } from "@/lib/pessoas/relatorio-idade";
import type { ContractStatus } from "@/lib/contratos/maquina-estados";

export interface RegiaoOpcao {
  id: string;
  nome: string;
}

export interface PessoaListada {
  id: string;
  nomeCompleto: string;
  cpf: string;
  rg: string | null;
  dataNascimento: string | null;
  idade: number | null;
  telefone: string | null;
  email: string | null;
  endereco: string | null;
  cep: string | null;
  chavePix: string | null;
  banco: string | null;
  agencia: string | null;
  conta: string | null;
  funcao: string | null;
  regiaoId: string | null;
  regiaoNome: string | null;
  apta: boolean;
  /** "autoinscricao" quando a pessoa veio do link público `/inscricao/[slug]`. */
  origem: string | null;
  statusContrato: string | null;
  totalContratos: number;
  criadoEm: string | null;
  /** Fase 2, item 14 — checklist de pendências, já calculado a partir do estado
   * real de documentos/aptidão/contrato desta pessoa. */
  pendencias: Pendencia[];
  documentosResumo: {
    id?: string;
    tipo: string;
    status: "pendente" | "aprovado" | "rejeitado";
    versao: number;
  }[];
}

interface LinhaPessoa {
  id: string;
  nome_completo: string;
  cpf: string;
  rg: string | null;
  data_nascimento: string | null;
  telefone: string | null;
  email: string | null;
  endereco: string | null;
  cep: string | null;
  chave_pix: string | null;
  banco: string | null;
  agencia: string | null;
  conta: string | null;
  funcao: string | null;
  regiao_id: string | null;
  apta: boolean;
  origem: string | null;
  criado_em: string | null;
  regioes: { nome: string } | null;
  contratos: { id: string; status: string; criado_em: string }[] | null;
  documentos: { id?: string; tipo: string; status: "pendente" | "aprovado" | "rejeitado"; versao: number }[] | null;
}

export async function listarRegioes(): Promise<RegiaoOpcao[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("regioes").select("id, nome").order("nome");
  if (error) throw new Error("Não foi possível carregar as regiões.");
  return data ?? [];
}

/**
 * Quantos cadastros vindos da autoinscrição pública ainda não passaram pela
 * triagem (não estão aptos). Usado para o aviso no painel — RLS do usuário escopa
 * por organização/região.
 */
export async function contarAutoinscritosPendentes(): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("pessoas")
    .select("id", { count: "exact", head: true })
    .eq("origem", "autoinscricao")
    .eq("apta", false);
  if (error) return 0;
  return count ?? 0;
}

export async function listarPessoas(): Promise<PessoaListada[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pessoas")
    .select(
      "id, nome_completo, cpf, rg, data_nascimento, telefone, email, endereco, cep, chave_pix, banco, agencia, conta, " +
        "funcao, apta, origem, regiao_id, criado_em, regioes ( nome ), " +
        "contratos ( id, status, criado_em ), documentos ( id, tipo, status, versao )",
    )
    .order("criado_em", { ascending: false })
    .returns<LinhaPessoa[]>();

  if (error) throw new Error("Não foi possível carregar as pessoas.");

  return (data ?? []).map((linha) => {
    // "Mais recente" entre os contratos da pessoa — hoje quase sempre 0 ou 1, mas o
    // caso de distrato+recontratação (Seção 7) pode gerar mais de um.
    const contratosLista = linha.contratos ?? [];
    const maisRecente = [...contratosLista].sort(
      (a, b) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime(),
    )[0];
    const statusContrato = (maisRecente?.status ?? null) as ContractStatus | null;

    return {
      id: linha.id,
      nomeCompleto: linha.nome_completo,
      cpf: linha.cpf,
      rg: linha.rg,
      dataNascimento: linha.data_nascimento,
      idade: calcularIdade(linha.data_nascimento),
      telefone: linha.telefone,
      email: linha.email,
      endereco: linha.endereco,
      cep: linha.cep,
      chavePix: linha.chave_pix,
      banco: linha.banco,
      agencia: linha.agencia,
      conta: linha.conta,
      funcao: linha.funcao,
      regiaoId: linha.regiao_id,
      regiaoNome: linha.regioes?.nome ?? null,
      apta: linha.apta,
      origem: linha.origem,
      statusContrato,
      totalContratos: contratosLista.length,
      criadoEm: linha.criado_em,
      pendencias: calcularPendencias({
        documentos: (linha.documentos ?? []).map((d) => ({
          tipo: d.tipo,
          status: d.status,
          versao: d.versao,
        })),
        apta: linha.apta,
        contratoStatus: statusContrato,
      }),
      documentosResumo: (linha.documentos ?? []).map((d) => ({
        id: d.id,
        tipo: d.tipo,
        status: d.status,
        versao: d.versao,
      })),
    };
  });
}
