/**
 * Server Actions da tela de Atividades de Campo (Fase 4, item 1).
 *
 * A gravação passa por `validarRegistroAtividade` (lógica pura, testada) e usa o
 * cliente com RLS do usuário (`server.ts`) — nunca `admin.ts`. `sincronizado_em`
 * é gravado como agora porque este caminho é o registro feito com rede; a fila
 * offline (item 2) grava com `sincronizado_em` nulo e preenche ao subir.
 */
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { obterContextoUsuario } from "@/lib/supabase/contexto-usuario";
import { registerActivityWrite } from "@/lib/auditoria/registrar";
import {
  validarRegistroAtividade,
  type CampoRegistro,
  type EntradaRegistroAtividade,
} from "@/lib/atividades/registro-rapido";

export interface EstadoRegistroAtividade {
  status: "idle" | "sucesso" | "erro";
  erros?: Partial<Record<CampoRegistro, string>>;
  mensagem?: string;
  /** Muda a cada sucesso — o cliente usa para limpar o formulário e recarregar. */
  marca?: number;
}

/** "Hoje" no fuso de Brasília — a atividade de campo é registrada no relógio local. */
function hojeSaoPaulo(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

export async function registrarAtividade(
  entrada: EntradaRegistroAtividade,
): Promise<EstadoRegistroAtividade> {
  const validacao = validarRegistroAtividade(entrada, hojeSaoPaulo());
  if (!validacao.ok) {
    return { status: "erro", erros: validacao.erros };
  }

  const supabase = await createClient();
  const { organizationId, userId } = await obterContextoUsuario(supabase);
  if (!organizationId) {
    return { status: "erro", mensagem: "Sessão inválida — faça login novamente." };
  }

  const { valores } = validacao;

  // Se a região não veio no formulário, herda a da pessoa.
  let regiaoId = valores.regiaoId;
  if (!regiaoId) {
    const { data: pessoa } = await supabase
      .from("pessoas")
      .select("regiao_id")
      .eq("id", valores.pessoaId)
      .maybeSingle();
    regiaoId = pessoa?.regiao_id ?? null;
  }

  const { data: inserido, error } = await supabase
    .from("registros_atividade")
    .insert({
      organizacao_id: organizationId,
      pessoa_id: valores.pessoaId,
      regiao_id: regiaoId,
      data: valores.data,
      tipo: valores.tipo,
      quantidade: valores.quantidade,
      observacao: valores.observacao,
      sincronizado_em: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error || !inserido) {
    return {
      status: "erro",
      mensagem: "Não foi possível gravar a atividade. Tente de novo.",
    };
  }

  await registerActivityWrite({
    supabase,
    organizationId,
    userId,
    activityId: inserido.id,
  });

  revalidatePath("/atividades");
  revalidatePath("/configuracoes");
  return { status: "sucesso", marca: Date.now() };
}
