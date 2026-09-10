/**
 * Leitura das regiões de atuação e funções pretendidas — RLS do usuário (`server.ts`).
 */
import { createClient } from "@/lib/supabase/server";

export interface RegiaoListada {
  id: string;
  nome: string;
  pessoas: number;
}

export interface FuncaoPretendidaListada {
  id: string;
  nome: string;
  descricao: string | null;
  ativa: boolean;
  pessoas: number;
}

export const FUNCOES_PADRAO_CATALOGO = [
  {
    nome: "Administrativo e Montagem de Material",
    descricao: "Organização e distribuição de materiais de campanha",
  },
  {
    nome: "Coordenador de Comitê da Campanha",
    descricao: "Coordenação geral de comitê e articulação local",
  },
  {
    nome: "Administrativo Homeoffice",
    descricao: "Suporte administrativo remoto, cadastros e triagem",
  },
  {
    nome: "Militância e Mobilização de Rua",
    descricao: "Ações de rua, panfletagem e mobilização popular",
  },
] as const;

export async function listarRegioesComContagem(): Promise<RegiaoListada[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("regioes")
    .select("id, nome, pessoas(count)")
    .order("nome")
    .returns<{ id: string; nome: string; pessoas: { count: number }[] }[]>();

  if (error) throw new Error("Não foi possível carregar as regiões.");

  return (data ?? []).map((r) => ({
    id: r.id,
    nome: r.nome,
    pessoas: r.pessoas?.[0]?.count ?? 0,
  }));
}

export async function listarFuncoesPretendidasComContagem(): Promise<FuncaoPretendidaListada[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("funcoes_pretendidas")
    .select("id, nome, descricao, ativa")
    .order("nome");

  if (error) {
    console.error("Erro ao listar funções pretendidas:", error);
    return [];
  }

  let funcoes = data ?? [];

  // Se não houver funções cadastradas e nenhuma foi excluída no histórico,
  // auto-popula com as funções padrão do catálogo eleitoral
  if (funcoes.length === 0) {
    const { data: claimsData } = await supabase.auth.getClaims();
    const claims = claimsData?.claims as Record<string, unknown> | undefined;
    const orgId = claims?.organizacao_id as string | undefined;
    const papel = claims?.papel as string | undefined;

    if (orgId && (papel === "gestor" || papel === "superadmin")) {
      const { count: countExcluidas } = await supabase
        .from("dados_excluidos")
        .select("id", { count: "exact", head: true })
        .eq("tipo_registro", "funcao_pretendida");

      if ((countExcluidas ?? 0) === 0) {
        const registrosParaInserir = FUNCOES_PADRAO_CATALOGO.map((f) => ({
          organizacao_id: orgId,
          nome: f.nome,
          descricao: f.descricao,
          ativa: true,
        }));

        const { data: novas, error: errInsert } = await supabase
          .from("funcoes_pretendidas")
          .insert(registrosParaInserir)
          .select("id, nome, descricao, ativa")
          .order("nome");

        if (!errInsert && novas) {
          funcoes = novas;
        }
      }
    }
  }

  // Contagem de pessoas cadastradas com cada função
  const { data: pessoas } = await supabase.from("pessoas").select("funcao");
  const contagem: Record<string, number> = {};
  for (const p of pessoas ?? []) {
    if (p.funcao) {
      const chave = p.funcao.trim().toLowerCase();
      contagem[chave] = (contagem[chave] ?? 0) + 1;
    }
  }

  return funcoes.map((f) => ({
    id: f.id,
    nome: f.nome,
    descricao: f.descricao,
    ativa: f.ativa,
    pessoas: contagem[f.nome.trim().toLowerCase()] ?? 0,
  }));
}
