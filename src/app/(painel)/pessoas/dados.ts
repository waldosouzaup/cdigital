/**
 * Leitura de pessoas/regiões para a Fase 2 — sempre pelo cliente com RLS do usuário
 * (`server.ts`), nunca `admin.ts` (regra de ESLint em `eslint.config.mjs` já proíbe
 * isso dentro de `(painel)`). Isolamento por organização/região vem de graça da
 * policy — esta camada não filtra nada por conta própria.
 */
import { createClient } from "@/lib/supabase/server";
import { calcularPendencias, type Pendencia } from "@/lib/pessoas/pendencias";
import type { ContractStatus } from "@/lib/contratos/maquina-estados";

export interface RegiaoOpcao {
  id: string;
  nome: string;
}

export interface PessoaListada {
  id: string;
  nomeCompleto: string;
  cpf: string;
  telefone: string | null;
  funcao: string | null;
  regiaoId: string | null;
  regiaoNome: string | null;
  apta: boolean;
  /** "autoinscricao" quando a pessoa veio do link público `/inscricao/[slug]`. */
  origem: string | null;
  statusContrato: string | null;
  /** Fase 2, item 14 — checklist de pendências, já calculado a partir do estado
   * real de documentos/aptidão/contrato desta pessoa. */
  pendencias: Pendencia[];
}

interface LinhaPessoa {
  id: string;
  nome_completo: string;
  cpf: string;
  telefone: string | null;
  funcao: string | null;
  regiao_id: string | null;
  apta: boolean;
  origem: string | null;
  regioes: { nome: string } | null;
  contratos: { status: string; criado_em: string }[] | null;
  documentos: { tipo: string; status: "pendente" | "aprovado" | "rejeitado"; versao: number }[] | null;
}

export async function listarRegioes(): Promise<RegiaoOpcao[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("regioes").select("id, nome").order("nome");
  if (error) throw new Error("Não foi possível carregar as regiões.");
  return data ?? [];
}

export async function listarPessoas(): Promise<PessoaListada[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pessoas")
    .select(
      "id, nome_completo, cpf, telefone, funcao, apta, origem, regiao_id, regioes ( nome ), " +
        "contratos ( status, criado_em ), documentos ( tipo, status, versao )",
    )
    .order("criado_em", { ascending: false })
    .returns<LinhaPessoa[]>();

  if (error) throw new Error("Não foi possível carregar as pessoas.");

  return (data ?? []).map((linha) => {
    // "Mais recente" entre os contratos da pessoa — hoje quase sempre 0 ou 1, mas o
    // caso de distrato+recontratação (Seção 7) pode gerar mais de um.
    const maisRecente = [...(linha.contratos ?? [])].sort(
      (a, b) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime(),
    )[0];
    const statusContrato = (maisRecente?.status ?? null) as ContractStatus | null;

    return {
      id: linha.id,
      nomeCompleto: linha.nome_completo,
      cpf: linha.cpf,
      telefone: linha.telefone,
      funcao: linha.funcao,
      regiaoId: linha.regiao_id,
      regiaoNome: linha.regioes?.nome ?? null,
      apta: linha.apta,
      origem: linha.origem,
      statusContrato,
      pendencias: calcularPendencias({
        documentos: linha.documentos ?? [],
        apta: linha.apta,
        contratoStatus: statusContrato,
      }),
    };
  });
}
