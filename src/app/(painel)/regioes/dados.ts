/**
 * Leitura das regiões de atuação — item 2. RLS do usuário (`server.ts`); a
 * organização vem de graça da policy.
 */
import { createClient } from "@/lib/supabase/server";

export interface RegiaoListada {
  id: string;
  nome: string;
  pessoas: number;
}

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
