/**
 * Server Actions dos modelos de contrato — Fase 2, item 7: "Editor de templates com
 * marcadores {{nome}}, {{cpf}}, {{endereco}}, {{objeto}}, {{valor}},
 * {{valor_extenso}}, {{vigencia_inicio}}, {{vigencia_fim}}."
 *
 * Validação inline (não uma função separada testada): ao contrário do CRUD de
 * pessoas — onde o CPF tem uma regra de negócio real (dígito verificador,
 * duplicata) — aqui é só presença de campo obrigatório, proporcional ao risco.
 */
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { obterContextoUsuario } from "@/lib/supabase/contexto-usuario";

export interface EstadoSalvarTemplate {
  status: "idle" | "sucesso" | "erro";
  mensagem?: string;
}

export const ESTADO_INICIAL_SALVAR_TEMPLATE: EstadoSalvarTemplate = { status: "idle" };

function campoTexto(formData: FormData, nome: string): string {
  const valor = formData.get(nome);
  return typeof valor === "string" ? valor.trim() : "";
}

export async function salvarTemplate(
  _estadoAnterior: EstadoSalvarTemplate,
  formData: FormData,
): Promise<EstadoSalvarTemplate> {
  const id = campoTexto(formData, "id");
  const nome = campoTexto(formData, "nome");
  const objeto = campoTexto(formData, "objeto");
  const corpoHtml = campoTexto(formData, "corpoHtml");
  const valorPadraoTexto = campoTexto(formData, "valorPadrao");

  if (!nome || !objeto || !corpoHtml) {
    return { status: "erro", mensagem: "Preencha nome, objeto e o corpo do modelo." };
  }

  const valorPadrao = valorPadraoTexto ? Number(valorPadraoTexto.replace(",", ".")) : null;
  if (valorPadraoTexto && (Number.isNaN(valorPadrao) || (valorPadrao ?? 0) <= 0)) {
    return { status: "erro", mensagem: "Valor padrão precisa ser um número maior que zero." };
  }

  const supabase = await createClient();
  const { organizationId } = await obterContextoUsuario(supabase);
  if (!organizationId) return { status: "erro", mensagem: "Sessão inválida — faça login novamente." };

  const linha = {
    organizacao_id: organizationId,
    nome,
    objeto,
    corpo_html: corpoHtml,
    valor_padrao: valorPadrao,
  };

  const { error } = id
    ? await supabase.from("templates_contrato").update(linha).eq("id", id)
    : await supabase.from("templates_contrato").insert(linha);

  if (error) {
    return { status: "erro", mensagem: "Não foi possível salvar o modelo." };
  }

  revalidatePath("/configuracoes");
  return { status: "sucesso", mensagem: id ? "Modelo atualizado." : "Modelo criado." };
}

export async function alternarAtivoTemplate(
  templateId: string,
  ativo: boolean,
): Promise<{ ok: boolean; mensagem?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("templates_contrato")
    .update({ ativo })
    .eq("id", templateId);

  if (error) return { ok: false, mensagem: "Não foi possível atualizar o modelo." };

  revalidatePath("/configuracoes");
  return { ok: true };
}
