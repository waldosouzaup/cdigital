/**
 * Server Actions de pessoas — Fase 2, item 1: "CRUD de pessoas com validação de CPF
 * por dígito verificador; CPF duplicado exibe o registro existente em vez de criar
 * outro." Padrão de `useActionState` confirmado no Context 7 (ver CONSULTAS.md):
 * a action recebe `(estadoAnterior, formData)` e devolve um objeto de estado, nunca
 * lança para o cliente.
 */
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { registerPersonWrite } from "@/lib/auditoria/registrar";
import { validarEntradaPessoa, type EntradaPessoa } from "@/lib/pessoas/validacao";

export interface EstadoCriarPessoa {
  status: "idle" | "sucesso" | "erro" | "duplicada";
  errors?: Partial<Record<keyof EntradaPessoa, string>>;
  mensagem?: string;
  pessoaExistenteId?: string;
}

export const ESTADO_INICIAL_CRIAR_PESSOA: EstadoCriarPessoa = { status: "idle" };

function campoTexto(formData: FormData, nome: string): string {
  const valor = formData.get(nome);
  return typeof valor === "string" ? valor : "";
}

export async function criarPessoa(
  _estadoAnterior: EstadoCriarPessoa,
  formData: FormData,
): Promise<EstadoCriarPessoa> {
  const resultado = validarEntradaPessoa({
    fullName: campoTexto(formData, "fullName"),
    cpf: campoTexto(formData, "cpf"),
    phone: campoTexto(formData, "phone"),
    regionId: campoTexto(formData, "regionId"),
    role: campoTexto(formData, "role"),
  });

  if (!resultado.success) {
    return { status: "erro", errors: resultado.errors };
  }

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims as Record<string, unknown> | undefined;
  const organizationId = claims?.organizacao_id as string | undefined;
  const userId = (claims?.sub as string | undefined) ?? null;

  if (!organizationId) {
    return { status: "erro", mensagem: "Sessão inválida — faça login novamente." };
  }

  // Checagem prévia (Fase 2, item 1): "CPF duplicado exibe o registro existente em vez
  // de criar outro" — precisa achar e devolver a pessoa, não só recusar.
  const { data: existente } = await supabase
    .from("pessoas")
    .select("id, nome_completo")
    .eq("organizacao_id", organizationId)
    .eq("cpf", resultado.data.cpf)
    .maybeSingle();

  if (existente) {
    return {
      status: "duplicada",
      mensagem: `Já existe um cadastro com este CPF: ${existente.nome_completo}.`,
      pessoaExistenteId: existente.id,
    };
  }

  const { data: nova, error } = await supabase
    .from("pessoas")
    .insert({
      organizacao_id: organizationId,
      nome_completo: resultado.data.fullName,
      cpf: resultado.data.cpf,
      telefone: resultado.data.phone || null,
      funcao: resultado.data.role || null,
      regiao_id: resultado.data.regionId,
    })
    .select("id")
    .single();

  if (error || !nova) {
    // Índice único (organizacao_id, cpf) — rede de segurança contra corrida entre a
    // checagem acima e este insert. Código 23505 = unique_violation no Postgres.
    // Regra 7: nunca stack trace nem SQL cru na mensagem devolvida.
    if (error?.code === "23505") {
      return { status: "duplicada", mensagem: "Já existe um cadastro com este CPF." };
    }
    return { status: "erro", mensagem: "Não foi possível cadastrar a pessoa." };
  }

  await registerPersonWrite({
    supabase,
    organizationId,
    userId,
    personId: nova.id,
    action: "criacao",
  });

  revalidatePath("/pessoas");
  return { status: "sucesso", mensagem: "Pessoa cadastrada com sucesso." };
}
