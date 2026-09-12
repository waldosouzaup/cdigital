/**
 * Leitura da tela de Atividades de Campo (Fase 4, item 1) — sempre via `server.ts`
 * (RLS do usuário logado). Um `coord_regiao` só enxerga pessoas e registros da
 * própria região; o isolamento vem da policy, não desta camada.
 */
import { createClient } from "@/lib/supabase/server";

export interface RegiaoOpcao {
  id: string;
  nome: string;
}

export interface PessoaOpcao {
  id: string;
  nome: string;
  regiaoId: string | null;
}

export interface RegistroAtividadeListado {
  id: string;
  pessoaNome: string;
  regiaoNome: string | null;
  tipo: string;
  quantidade: number;
  data: string;
  observacao: string | null;
  sincronizadoEm: string | null;
  criadoEm: string;
  /** Coordenada de onde a atividade foi registrada (migration 0038). */
  latitude: number | null;
  longitude: number | null;
  precisaoM: number | null;
}

interface LinhaRegistro {
  id: string;
  data: string;
  tipo: string;
  quantidade: number;
  observacao: string | null;
  sincronizado_em: string | null;
  criado_em: string;
  latitude: string | number | null;
  longitude: string | number | null;
  precisao_m: string | number | null;
  pessoas: { nome_completo: string } | { nome_completo: string }[] | null;
  regioes: { nome: string } | { nome: string }[] | null;
}

function primeiro<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function numeroOuNulo(valor: string | number | null): number | null {
  if (valor === null) return null;
  const n = typeof valor === "number" ? valor : Number(valor);
  return Number.isFinite(n) ? n : null;
}

export async function listarContextoAtividades(): Promise<{
  regioes: RegiaoOpcao[];
  pessoas: PessoaOpcao[];
  registros: RegistroAtividadeListado[];
}> {
  const supabase = await createClient();

  const [regioesRes, pessoasRes, registrosRes] = await Promise.all([
    supabase.from("regioes").select("id, nome").order("nome"),
    supabase.from("pessoas").select("id, nome_completo, regiao_id").order("nome_completo"),
    supabase
      .from("registros_atividade")
      .select(
        "id, data, tipo, quantidade, observacao, sincronizado_em, criado_em, latitude, longitude, precisao_m, pessoas ( nome_completo ), regioes ( nome )",
      )
      .order("criado_em", { ascending: false })
      .limit(30)
      .returns<LinhaRegistro[]>(),
  ]);

  if (regioesRes.error) throw new Error("Não foi possível carregar as regiões.");
  if (pessoasRes.error) throw new Error("Não foi possível carregar as pessoas.");
  if (registrosRes.error) throw new Error("Não foi possível carregar os registros de atividade.");

  return {
    regioes: regioesRes.data ?? [],
    pessoas: (pessoasRes.data ?? []).map((p) => ({
      id: p.id,
      nome: p.nome_completo,
      regiaoId: p.regiao_id,
    })),
    registros: (registrosRes.data ?? []).map((linha) => ({
      id: linha.id,
      pessoaNome: primeiro(linha.pessoas)?.nome_completo ?? "—",
      regiaoNome: primeiro(linha.regioes)?.nome ?? null,
      tipo: linha.tipo,
      quantidade: linha.quantidade,
      data: linha.data,
      observacao: linha.observacao,
      sincronizadoEm: linha.sincronizado_em,
      criadoEm: linha.criado_em,
      // O Postgres devolve `numeric` como string; sem converter, a tela
      // imprimiria a coordenada com a precisão textual do banco.
      latitude: numeroOuNulo(linha.latitude),
      longitude: numeroOuNulo(linha.longitude),
      precisaoM: numeroOuNulo(linha.precisao_m),
    })),
  };
}
