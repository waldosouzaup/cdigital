/**
 * Leitura da escala de turnos (migration 0043). RLS do usuário cuida do
 * isolamento por organização.
 */
import { createClient } from "@/lib/supabase/server";

export interface TurnoListado {
  id: string;
  pessoaNome: string;
  regiaoNome: string | null;
  inicio: string;
  fim: string;
  funcao: string | null;
  local: string | null;
  observacao: string | null;
}

interface LinhaTurno {
  id: string;
  inicio: string;
  fim: string;
  funcao: string | null;
  local: string | null;
  observacao: string | null;
  pessoas: { nome_completo: string } | { nome_completo: string }[] | null;
  regioes: { nome: string } | { nome: string }[] | null;
}

function primeiro<T>(valor: T | T[] | null): T | null {
  if (!valor) return null;
  return Array.isArray(valor) ? (valor[0] ?? null) : valor;
}

export async function listarEscala(): Promise<TurnoListado[]> {
  const supabase = await createClient();

  // Janela a partir de ontem: escala é instrumento de planejamento, e turno
  // antigo só polui a tela — o histórico do que foi executado vive em
  // `registros_atividade`.
  const ontem = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

  const { data, error } = await supabase
    .from("escalas")
    .select("id, inicio, fim, funcao, local, observacao, pessoas ( nome_completo ), regioes ( nome )")
    .gte("fim", ontem)
    .order("inicio")
    .limit(200)
    .returns<LinhaTurno[]>();

  if (error) throw new Error("Não foi possível carregar a escala.");

  return (data ?? []).map((linha) => ({
    id: linha.id,
    pessoaNome: primeiro(linha.pessoas)?.nome_completo ?? "—",
    regiaoNome: primeiro(linha.regioes)?.nome ?? null,
    inicio: linha.inicio,
    fim: linha.fim,
    funcao: linha.funcao,
    local: linha.local,
    observacao: linha.observacao,
  }));
}
