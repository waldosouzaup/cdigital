/**
 * Server Actions de regiões de atuação e funções pretendidas.
 *
 * Permissões: Apenas gestores e superadmins podem criar, renomear, alternar status
 * e excluir regiões e funções pretendidas.
 */
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { validarNomeRegiao } from "@/lib/regioes/validacao";
import { validarFuncaoPretendida } from "@/lib/regioes/validacao-funcao";
import { FUNCOES_PADRAO_CATALOGO } from "./dados";
import type { EstadoFuncao, EstadoRegiao } from "./estado";

async function contexto(): Promise<{
  supabase: Awaited<ReturnType<typeof createClient>>;
  organizationId?: string;
  userId?: string | null;
  papel?: string;
}> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims as Record<string, unknown> | undefined;
  return {
    supabase,
    organizationId: claims?.organizacao_id as string | undefined,
    userId: (claims?.sub as string | undefined) ?? null,
    papel: claims?.papel as string | undefined,
  };
}

function podeGerenciar(papel?: string): boolean {
  return papel === "gestor" || papel === "superadmin";
}

async function dadosUsuarioLogado(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId?: string | null,
): Promise<{ nome: string; login: string }> {
  if (!userId) return { nome: "Gestor", login: "gestor@sistema" };
  const { data } = await supabase
    .from("usuarios")
    .select("nome, email")
    .eq("id", userId)
    .maybeSingle();
  return {
    nome: data?.nome || "Gestor",
    login: data?.email || "gestor@sistema",
  };
}

async function nomesRegioesExistentes(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string[]> {
  const { data } = await supabase.from("regioes").select("nome");
  return (data ?? []).map((r) => r.nome as string);
}

async function nomesFuncoesExistentes(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string[]> {
  const { data } = await supabase.from("funcoes_pretendidas").select("nome");
  return (data ?? []).map((f) => f.nome as string);
}

function revalidarTudo(): void {
  revalidatePath("/regioes");
  revalidatePath("/configuracoes");
  revalidatePath("/pessoas");
  revalidatePath("/contratos");
  revalidatePath("/atividades");
}

/* ==========================================================================
   CRUD: Regiões de Atuação
   ========================================================================== */

export async function criarRegiao(
  _estadoAnterior: EstadoRegiao,
  formData: FormData,
): Promise<EstadoRegiao> {
  const { supabase, organizationId, papel } = await contexto();
  if (!organizationId) return { status: "erro", mensagem: "Sessão inválida — faça login de novo." };
  if (!podeGerenciar(papel)) {
    return { status: "erro", mensagem: "Apenas gestores ou superadministradores podem cadastrar regiões." };
  }

  const nomeBruto = String(formData.get("nome") ?? "");
  const validacao = validarNomeRegiao(nomeBruto, await nomesRegioesExistentes(supabase));
  if (!validacao.ok) return { status: "erro", erro: validacao.erro };

  const { error } = await supabase
    .from("regioes")
    .insert({ organizacao_id: organizationId, nome: validacao.nome });
  if (error) {
    return { status: "erro", mensagem: "Não foi possível criar a região." };
  }

  revalidarTudo();
  return { status: "sucesso", mensagem: `Região "${validacao.nome}" criada com sucesso.` };
}

export async function renomearRegiao(
  _estadoAnterior: EstadoRegiao,
  formData: FormData,
): Promise<EstadoRegiao> {
  const { supabase, organizationId, papel } = await contexto();
  if (!organizationId) return { status: "erro", mensagem: "Sessão inválida — faça login de novo." };
  if (!podeGerenciar(papel)) {
    return { status: "erro", mensagem: "Apenas gestores ou superadministradores podem renomear regiões." };
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
    await nomesRegioesExistentes(supabase),
    (atual?.nome as string | undefined) ?? undefined,
  );
  if (!validacao.ok) return { status: "erro", erro: validacao.erro };

  const { error } = await supabase.from("regioes").update({ nome: validacao.nome }).eq("id", id);
  if (error) {
    return { status: "erro", mensagem: "Não foi possível renomear a região." };
  }

  revalidarTudo();
  return { status: "sucesso", mensagem: "Região renomeada com sucesso." };
}

export async function excluirRegiao(
  id: string,
  motivo?: string,
): Promise<{ ok: boolean; mensagem: string }> {
  const { supabase, organizationId, userId, papel } = await contexto();
  if (!organizationId) return { ok: false, mensagem: "Sessão inválida — faça login de novo." };
  if (!podeGerenciar(papel)) {
    return { ok: false, mensagem: "Apenas gestores ou superadministradores podem excluir regiões." };
  }
  if (!id) return { ok: false, mensagem: "Região não informada." };

  // Busca dados da região antes de excluir
  const { data: regiao } = await supabase
    .from("regioes")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!regiao) return { ok: false, mensagem: "Região não encontrada." };

  // Trava de integridade: checa referências vinculadas
  const [
    { count: countPessoas },
    { count: countContratos },
    { count: countUsuarios },
    { count: countAtividades },
  ] = await Promise.all([
    supabase.from("pessoas").select("id", { count: "exact", head: true }).eq("regiao_id", id),
    supabase.from("contratos").select("id", { count: "exact", head: true }).eq("regiao_id", id),
    supabase.from("usuarios").select("id", { count: "exact", head: true }).eq("regiao_id", id),
    supabase.from("atividades").select("id", { count: "exact", head: true }).eq("regiao_id", id),
  ]);

  const vinculados: string[] = [];
  if (countPessoas && countPessoas > 0) vinculados.push(`${countPessoas} pessoa(s)`);
  if (countContratos && countContratos > 0) vinculados.push(`${countContratos} contrato(s)`);
  if (countUsuarios && countUsuarios > 0) vinculados.push(`${countUsuarios} usuário(s)`);
  if (countAtividades && countAtividades > 0) vinculados.push(`${countAtividades} atividade(s)`);

  if (vinculados.length > 0) {
    return {
      ok: false,
      mensagem: `Não é possível excluir esta região pois existem registros vinculados (${vinculados.join(", ")}). Realoque os registros para outra região antes de excluir.`,
    };
  }

  // Grava snapshot de auditoria em dados_excluidos
  const usuarioInfo = await dadosUsuarioLogado(supabase, userId);
  const { error: erroAudit } = await supabase.from("dados_excluidos").insert({
    organizacao_id: organizationId,
    tipo_registro: "regiao",
    registro_id: id,
    dados: regiao,
    usuario_id: userId,
    usuario_nome: usuarioInfo.nome,
    usuario_login: usuarioInfo.login,
    motivo: motivo?.trim() || "Exclusão de região pelo painel administrativo",
  });

  if (erroAudit) {
    console.error("Erro ao arquivar região em dados_excluidos:", erroAudit);
    return {
      ok: false,
      mensagem: "Não foi possível registrar o arquivamento de auditoria antes da exclusão.",
    };
  }

  const { error: erroDelete } = await supabase.from("regioes").delete().eq("id", id);
  if (erroDelete) {
    return {
      ok: false,
      mensagem: `Erro ao remover região: ${erroDelete.message}`,
    };
  }

  revalidarTudo();
  return { ok: true, mensagem: `Região "${regiao.nome}" excluída com sucesso.` };
}

/* ==========================================================================
   CRUD: Funções Pretendidas (Atividades de Inscrição)
   ========================================================================== */

export async function criarFuncaoPretendida(
  _estadoAnterior: EstadoFuncao,
  formData: FormData,
): Promise<EstadoFuncao> {
  const { supabase, organizationId, papel } = await contexto();
  if (!organizationId) return { status: "erro", mensagem: "Sessão inválida — faça login de novo." };
  if (!podeGerenciar(papel)) {
    return { status: "erro", mensagem: "Apenas gestores ou superadministradores podem cadastrar funções." };
  }

  const nomeBruto = String(formData.get("nome") ?? "");
  const descricaoBruta = String(formData.get("descricao") ?? "");

  const validacao = validarFuncaoPretendida(
    nomeBruto,
    descricaoBruta,
    await nomesFuncoesExistentes(supabase),
  );
  if (!validacao.ok) return { status: "erro", erro: validacao.erro };

  const { error } = await supabase.from("funcoes_pretendidas").insert({
    organizacao_id: organizationId,
    nome: validacao.nome,
    descricao: validacao.descricao,
    ativa: true,
  });

  if (error) {
    console.error("Erro ao inserir função pretendida:", error);
    return { status: "erro", mensagem: "Não foi possível cadastrar a função pretendida." };
  }

  revalidarTudo();
  return { status: "sucesso", mensagem: `Função "${validacao.nome}" cadastrada com sucesso.` };
}

export async function editarFuncaoPretendida(
  _estadoAnterior: EstadoFuncao,
  formData: FormData,
): Promise<EstadoFuncao> {
  const { supabase, organizationId, papel } = await contexto();
  if (!organizationId) return { status: "erro", mensagem: "Sessão inválida — faça login de novo." };
  if (!podeGerenciar(papel)) {
    return { status: "erro", mensagem: "Apenas gestores ou superadministradores podem editar funções." };
  }

  const id = String(formData.get("id") ?? "");
  const nomeBruto = String(formData.get("nome") ?? "");
  const descricaoBruta = String(formData.get("descricao") ?? "");
  if (!id) return { status: "erro", mensagem: "Função não informada." };

  const { data: atual } = await supabase
    .from("funcoes_pretendidas")
    .select("nome")
    .eq("id", id)
    .maybeSingle();

  const validacao = validarFuncaoPretendida(
    nomeBruto,
    descricaoBruta,
    await nomesFuncoesExistentes(supabase),
    (atual?.nome as string | undefined) ?? undefined,
  );
  if (!validacao.ok) return { status: "erro", erro: validacao.erro };

  const { error } = await supabase
    .from("funcoes_pretendidas")
    .update({
      nome: validacao.nome,
      descricao: validacao.descricao,
    })
    .eq("id", id);

  if (error) {
    console.error("Erro ao atualizar função pretendida:", error);
    return { status: "erro", mensagem: "Não foi possível atualizar a função pretendida." };
  }

  revalidarTudo();
  return { status: "sucesso", mensagem: "Função pretendida atualizada com sucesso." };
}

export async function alternarAtivaFuncaoPretendida(
  id: string,
  ativa: boolean,
): Promise<{ ok: boolean; mensagem?: string; erro?: string }> {
  const { supabase, organizationId, papel } = await contexto();
  if (!organizationId) return { ok: false, erro: "Sessão inválida — faça login de novo." };
  if (!podeGerenciar(papel)) {
    return { ok: false, erro: "Apenas gestores ou superadministradores podem alterar status de funções." };
  }
  if (!id) return { ok: false, erro: "Função não informada." };

  const { error } = await supabase
    .from("funcoes_pretendidas")
    .update({ ativa })
    .eq("id", id);

  if (error) {
    return { ok: false, erro: "Não foi possível alterar o status da função." };
  }

  revalidarTudo();
  return {
    ok: true,
    mensagem: `Função ${ativa ? "ativada" : "desativada"} no formulário de inscrição pública.`,
  };
}

export async function excluirFuncaoPretendida(
  id: string,
  motivo?: string,
): Promise<{ ok: boolean; mensagem?: string; erro?: string }> {
  const { supabase, organizationId, userId, papel } = await contexto();
  if (!organizationId) return { ok: false, erro: "Sessão inválida — faça login de novo." };
  if (!podeGerenciar(papel)) {
    return { ok: false, erro: "Apenas gestores ou superadministradores podem excluir funções." };
  }
  if (!id) return { ok: false, erro: "Função não informada." };

  const { data: funcao } = await supabase
    .from("funcoes_pretendidas")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!funcao) return { ok: false, erro: "Função pretendida não encontrada." };

  // Grava snapshot de auditoria em dados_excluidos
  const usuarioInfo = await dadosUsuarioLogado(supabase, userId);
  const { error: erroAudit } = await supabase.from("dados_excluidos").insert({
    organizacao_id: organizationId,
    tipo_registro: "funcao_pretendida",
    registro_id: id,
    dados: funcao,
    usuario_id: userId,
    usuario_nome: usuarioInfo.nome,
    usuario_login: usuarioInfo.login,
    motivo: motivo?.trim() || "Exclusão de função pretendida pelo painel administrativo",
  });

  if (erroAudit) {
    console.error("Erro ao arquivar função em dados_excluidos:", erroAudit);
    return {
      ok: false,
      erro: "Não foi possível registrar o arquivamento de auditoria antes da exclusão.",
    };
  }

  const { error: erroDelete } = await supabase
    .from("funcoes_pretendidas")
    .delete()
    .eq("id", id);

  if (erroDelete) {
    return { ok: false, erro: `Não foi possível excluir a função: ${erroDelete.message}` };
  }

  revalidarTudo();
  return { ok: true, mensagem: `Função "${funcao.nome}" excluída com sucesso.` };
}

export async function restaurarFuncoesPadrao(): Promise<{ ok: boolean; mensagem?: string; erro?: string }> {
  const { supabase, organizationId, papel } = await contexto();
  if (!organizationId) return { ok: false, erro: "Sessão inválida — faça login de novo." };
  if (!podeGerenciar(papel)) {
    return { ok: false, erro: "Apenas gestores ou superadministradores podem restaurar funções padrão." };
  }

  const existentes = await nomesFuncoesExistentes(supabase);
  const faltantes = FUNCOES_PADRAO_CATALOGO.filter(
    (padrao) => !existentes.some((e) => e.trim().toLowerCase() === padrao.nome.trim().toLowerCase()),
  );

  if (faltantes.length === 0) {
    return { ok: true, mensagem: "Todas as funções padrão já estão cadastradas." };
  }

  const registros = faltantes.map((f) => ({
    organizacao_id: organizationId,
    nome: f.nome,
    descricao: f.descricao,
    ativa: true,
  }));

  const { error } = await supabase.from("funcoes_pretendidas").insert(registros);
  if (error) {
    return { ok: false, erro: "Não foi possível restaurar as funções padrão." };
  }

  revalidarTudo();
  return { ok: true, mensagem: `${faltantes.length} função(ões) padrão restaurada(s) com sucesso.` };
}
