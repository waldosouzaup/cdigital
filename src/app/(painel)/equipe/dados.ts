/**
 * Leitura da equipe (Gestão de Acessos — Feature A). RLS do usuário (`server.ts`):
 * a policy `usuarios_select` (migration 0016) escopa por organização; a escrita é
 * exclusiva do gestor (`usuarios_*_gestor`).
 */
import { createClient } from "@/lib/supabase/server";

export interface MembroEquipe {
  id: string;
  nome: string;
  email: string;
  papel: string;
  regiaoId: string | null;
  regiaoNome: string | null;
  ativo: boolean;
}

interface LinhaUsuario {
  id: string;
  nome: string;
  email: string;
  papel: string;
  regiao_id: string | null;
  ativo: boolean;
  regioes: { nome: string } | null;
}

export async function listarEquipe(): Promise<MembroEquipe[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("usuarios")
    .select("id, nome, email, papel, regiao_id, ativo, regioes ( nome )")
    .order("nome")
    .returns<LinhaUsuario[]>();

  if (error) throw new Error("Não foi possível carregar a equipe.");

  return (data ?? []).map((u) => ({
    id: u.id,
    nome: u.nome,
    email: u.email,
    papel: u.papel,
    regiaoId: u.regiao_id,
    regiaoNome: u.regioes?.nome ?? null,
    ativo: u.ativo,
  }));
}
