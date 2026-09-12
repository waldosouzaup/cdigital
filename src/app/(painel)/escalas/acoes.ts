/**
 * Server Actions da escala de turnos (migration 0043).
 *
 * A gravação passa por `validarEscala` (lógica pura, testada) e usa o cliente
 * com RLS do usuário — nunca `admin.ts`. A ausência de sobreposição é garantida
 * pela restrição de exclusão no banco; a checagem aqui existe para transformar
 * um 23P01 numa frase que a pessoa entende.
 */
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { obterContextoUsuario } from "@/lib/supabase/contexto-usuario";
import {
  validarEscala,
  type CampoEscala,
  type EntradaEscala,
} from "@/lib/escalas/validacao";

const PAPEIS_ESCALA = ["gestor", "admin", "superadmin", "coord_comite", "coord_regiao"];

export interface EstadoEscala {
  status: "idle" | "sucesso" | "erro";
  erros?: Partial<Record<CampoEscala, string>>;
  mensagem?: string;
  marca?: number;
}

export async function criarEscala(entrada: EntradaEscala): Promise<EstadoEscala> {
  const supabase = await createClient();
  const { organizationId, papel } = await obterContextoUsuario(supabase);
  if (!organizationId) return { status: "erro", mensagem: "Sessão inválida — faça login de novo." };
  if (!PAPEIS_ESCALA.includes(papel ?? "")) {
    return { status: "erro", mensagem: "Seu papel não permite montar escala." };
  }

  // Janela estreita em torno do turno pedido: trazer a agenda inteira da pessoa
  // só para checar conflito não escala com o tamanho do evento.
  const { data: existentes } = await supabase
    .from("escalas")
    .select("inicio, fim")
    .eq("pessoa_id", (entrada.pessoaId ?? "").trim())
    .gte("fim", new Date(Date.parse(entrada.inicio) - 48 * 3600 * 1000).toISOString())
    .lte("inicio", new Date(Date.parse(entrada.fim) + 48 * 3600 * 1000).toISOString());

  const validacao = validarEscala(entrada, existentes ?? []);
  if (!validacao.ok) return { status: "erro", erros: validacao.erros };

  const { valores } = validacao;
  const { error } = await supabase.from("escalas").insert({
    organizacao_id: organizationId,
    pessoa_id: valores.pessoaId,
    regiao_id: valores.regiaoId,
    contrato_id: valores.contratoId,
    inicio: valores.inicio,
    fim: valores.fim,
    funcao: valores.funcao,
    local: valores.local,
    observacao: valores.observacao,
  });

  if (error) {
    // 23P01 = violação da restrição de exclusão. Só chega aqui se o conflito
    // nasceu entre a leitura acima e a gravação — duas telas abertas, por exemplo.
    if ((error as { code?: string }).code === "23P01") {
      return {
        status: "erro",
        erros: { inicio: "Esta pessoa acabou de ser escalada em outro turno neste horário." },
      };
    }
    return { status: "erro", mensagem: "Não foi possível salvar o turno. Tente de novo." };
  }

  revalidatePath("/escalas");
  return { status: "sucesso", mensagem: "Turno criado.", marca: Date.now() };
}

export async function excluirEscala(escalaId: string): Promise<EstadoEscala> {
  const supabase = await createClient();
  const { organizationId, papel } = await obterContextoUsuario(supabase);
  if (!organizationId) return { status: "erro", mensagem: "Sessão inválida — faça login de novo." };
  if (!PAPEIS_ESCALA.includes(papel ?? "")) {
    return { status: "erro", mensagem: "Seu papel não permite alterar escala." };
  }

  const { error } = await supabase.from("escalas").delete().eq("id", escalaId);
  if (error) return { status: "erro", mensagem: "Não foi possível remover o turno." };

  revalidatePath("/escalas");
  return { status: "sucesso", mensagem: "Turno removido.", marca: Date.now() };
}
