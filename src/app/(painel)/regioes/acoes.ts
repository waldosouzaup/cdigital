/**
 * Server Actions de regiões de atuação — item 2 do feedback do coordenador.
 *
 * Só gestor: a policy `regioes_insert_gestor`/`regioes_update_gestor` (migration
 * 0015) já barra os demais; a checagem aqui devolve mensagem clara em vez de erro
 * genérico de RLS.
 */
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { validarNomeRegiao } from "@/lib/regioes/validacao";
import type { EstadoRegiao } from "./estado";

async function contexto(): Promise<{
  supabase: Awaited<ReturnType<typeof createClient>>;
  organizationId?: string;
  papel?: string;
}> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims as Record<string, unknown> | undefined;
  return {
    supabase,
    organizationId: claims?.organizacao_id as string | undefined,
    papel: claims?.papel as string | undefined,
  };
}

async function nomesExistentes(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string[]> {
  const { data } = await supabase.from("regioes").select("nome");
  return (data ?? []).map((r) => r.nome as string);
}

export async function criarRegiao(
  _estadoAnterior: EstadoRegiao,
  formData: FormData,
): Promise<EstadoRegiao> {
  const { supabase, organizationId, papel } = await contexto();
  if (!organizationId) return { status: "erro", mensagem: "Sessão inválida — faça login de novo." };
  if (papel !== "gestor") {
    return { status: "erro", mensagem: "Só o gestor pode cadastrar regiões." };
  }

  const nomeBruto = String(formData.get("nome") ?? "");
  const validacao = validarNomeRegiao(nomeBruto, await nomesExistentes(supabase));
  if (!validacao.ok) return { status: "erro", erro: validacao.erro };

  const { error } = await supabase
    .from("regioes")
    .insert({ organizacao_id: organizationId, nome: validacao.nome });
  if (error) {
    return { status: "erro", mensagem: "Não foi possível criar a região." };
  }

  revalidatePath("/regioes");
  revalidatePath("/configuracoes");
  revalidatePath("/pessoas");
  return { status: "sucesso", mensagem: `Região "${validacao.nome}" criada.` };
}

export async function renomearRegiao(
  _estadoAnterior: EstadoRegiao,
  formData: FormData,
): Promise<EstadoRegiao> {
  const { supabase, organizationId, papel } = await contexto();
  if (!organizationId) return { status: "erro", mensagem: "Sessão inválida — faça login de novo." };
  if (papel !== "gestor") {
    return { status: "erro", mensagem: "Só o gestor pode renomear regiões." };
  }

  const id = String(formData.get("id") ?? "");
  const nomeBruto = String(formData.get("nome") ?? "");
  if (!id) return { status: "erro", mensagem: "Região não informada." };

  const { data: atual } = await supabase
    .from("regioes")
    .select("nome")
    .eq("id", id)
    .maybeSingle();

  const validacao = validarNomeRegiao(
    nomeBruto,
    await nomesExistentes(supabase),
    (atual?.nome as string | undefined) ?? undefined,
  );
  if (!validacao.ok) return { status: "erro", erro: validacao.erro };

  const { error } = await supabase.from("regioes").update({ nome: validacao.nome }).eq("id", id);
  if (error) {
    return { status: "erro", mensagem: "Não foi possível renomear a região." };
  }

  revalidatePath("/regioes");
  revalidatePath("/configuracoes");
  revalidatePath("/pessoas");
  return { status: "sucesso", mensagem: "Região renomeada." };
}
