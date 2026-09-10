/**
 * Server Action do lado de quem RECEBE o link — sem sessão, sem organizacao_id no
 * JWT. Por isso não faz nenhuma leitura/escrita direta em tabela: chama só a função
 * SECURITY DEFINER `enviar_dados_coleta` (migration 0005), que revalida o token por
 * conta própria (não confia em nada que já foi checado na tela) antes de gravar.
 */
"use server";

import { createClient } from "@/lib/supabase/server";
import type { EstadoEnviarDadosColeta } from "./estado";

function campoOuNulo(formData: FormData, nome: string): string | null {
  const valor = formData.get(nome);
  return typeof valor === "string" && valor.trim() !== "" ? valor.trim() : null;
}

export async function enviarDadosColeta(
  token: string,
  _estadoAnterior: EstadoEnviarDadosColeta,
  formData: FormData,
): Promise<EstadoEnviarDadosColeta> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("enviar_dados_coleta", {
    p_token: token,
    p_telefone: campoOuNulo(formData, "telefone"),
    p_endereco: campoOuNulo(formData, "endereco"),
    p_cep: campoOuNulo(formData, "cep"),
    p_rg: campoOuNulo(formData, "rg"),
    p_data_nascimento: campoOuNulo(formData, "dataNascimento"),
    p_chave_pix: campoOuNulo(formData, "chavePix"),
    p_email: campoOuNulo(formData, "email"),
  });

  if (error) {
    // Regra 7: nada de stack trace/SQL cru para quem não tem login nem treinamento.
    return { status: "erro", mensagem: "Não foi possível enviar seus dados. Tente novamente." };
  }

  if (data !== true) {
    return {
      status: "erro",
      mensagem: "Este link já foi usado ou expirou. Peça um novo link à coordenação.",
    };
  }

  return { status: "sucesso" };
}
