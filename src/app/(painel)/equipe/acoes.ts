/**
 * Server Actions de Gestão de Acessos (Feature A) — alteração de papel/região de um
 * membro já existente. Só gestor: as policies `usuarios_update_gestor` (migration
 * 0016) já barram os demais; a checagem aqui devolve mensagem clara em vez de erro
 * genérico de RLS.
 *
 * Convite (criar membro) e (des)ativação passam pelo Route Handler
 * `/api/equipe/convite` — este arquivo está sob `(painel)/**` e não pode importar
 * `@/lib/supabase/admin`.
 */
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { validarEntradaUsuario } from "@/lib/equipe/validacao";
import type { EstadoAlterarPapel } from "./estado";

const PAPEIS_VALIDOS = ["gestor", "coord_comite", "coord_regiao", "contratado", "auditor"] as const;

async function contexto() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims as Record<string, unknown> | undefined;
  return {
    supabase,
    organizationId: claims?.organizacao_id as string | undefined,
    papel: claims?.papel as string | undefined,
  };
}

export async function alterarPapelUsuario(
  _estadoAnterior: EstadoAlterarPapel,
  formData: FormData,
): Promise<EstadoAlterarPapel> {
  const { supabase, organizationId, papel } = await contexto();
  if (!organizationId) return { status: "erro", mensagem: "Sessão inválida — faça login de novo." };
  if (papel !== "gestor") {
    return { status: "erro", mensagem: "Só o gestor gerencia acessos." };
  }

  const id = String(formData.get("id") ?? "");
  if (!id) return { status: "erro", mensagem: "Membro não informado." };

  const { data: atual } = await supabase
    .from("usuarios")
    .select("nome, email")
    .eq("id", id)
    .maybeSingle();
  if (!atual) return { status: "erro", mensagem: "Membro não encontrado." };

  const { data: regioes } = await supabase.from("regioes").select("id");
  const regioesIds = (regioes ?? []).map((r) => r.id as string);

  const validacao = validarEntradaUsuario(
    {
      nome: atual.nome as string,
      email: atual.email as string,
      papel: String(formData.get("papel") ?? ""),
      regiaoId: String(formData.get("regiaoId") ?? ""),
    },
    { papeisValidos: PAPEIS_VALIDOS, regioesIds },
  );
  if (!validacao.ok) return { status: "erro", erros: validacao.erros };

  const { error } = await supabase
    .from("usuarios")
    .update({ papel: validacao.valores.papel, regiao_id: validacao.valores.regiaoId })
    .eq("id", id);

  if (error) {
    return { status: "erro", mensagem: "Não foi possível atualizar o acesso." };
  }

  revalidatePath("/equipe");
  revalidatePath("/configuracoes");
  return { status: "sucesso", mensagem: "Acesso atualizado. Vale a partir do próximo login do membro." };
}
