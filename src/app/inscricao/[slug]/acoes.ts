/**
 * Server Action da autoinscrição pública (Feature B). Sem sessão: usa o cliente
 * anon (`server.ts`) e só chama funções `SECURITY DEFINER` (migration 0017) —
 * nunca `.from()` direto nem `admin.ts`. Nunca lança; devolve objeto de estado
 * com mensagens genéricas (Regra 7 — sem SQL cru).
 */
"use server";

import { createClient } from "@/lib/supabase/server";
import { extrairMetadadosAuditoria } from "@/lib/auditoria/metadados-requisicao";
import { gerarTokenColeta } from "@/lib/coleta/token";
import { validarEntradaInscricao } from "@/lib/inscricao/validacao";
import type { EstadoInscricao } from "./estado";

interface DadosInscricao {
  organizacao_id: string;
  organizacao_nome: string;
  regioes: { id: string; nome: string }[];
  funcoes: string[];
}

interface ResultadoInscrever {
  token: string | null;
  ja_existia: boolean;
  erro: string | null;
}

const MENSAGEM_ERRO: Record<string, string> = {
  consentimento: "É preciso aceitar o uso dos dados para se inscrever.",
  indisponivel: "As inscrições para este comitê não estão disponíveis.",
  regiao: "A região selecionada não está disponível para esta inscrição.",
};

function campo(formData: FormData, nome: string): string {
  const valor = formData.get(nome);
  return typeof valor === "string" ? valor : "";
}

export async function inscreverCandidato(
  slug: string,
  _estadoAnterior: EstadoInscricao,
  formData: FormData,
): Promise<EstadoInscricao> {
  const supabase = await createClient();

  // Listas autoritativas (não confia no que veio do cliente).
  const { data: dados, error: erroDados } = await supabase
    .rpc("dados_inscricao_publica", { p_slug: slug })
    .maybeSingle<DadosInscricao>();

  if (erroDados || !dados) {
    return { status: "erro", mensagem: MENSAGEM_ERRO.indisponivel };
  }

  const validacao = validarEntradaInscricao(
    {
      nomeCompleto: campo(formData, "nomeCompleto"),
      cpf: campo(formData, "cpf"),
      telefone: campo(formData, "telefone"),
      email: campo(formData, "email"),
      regiaoId: campo(formData, "regiaoId"),
      funcao: campo(formData, "funcao"),
      consentimento: formData.get("consentimento") === "on",
    },
    {
      regioesIds: dados.regioes.map((r) => r.id),
      funcoes: dados.funcoes,
    },
  );
  if (!validacao.success) {
    return { status: "erro", errors: validacao.errors };
  }

  const { ip, userAgent, geoHeaders } = await extrairMetadadosAuditoria();
  const geoRaw = campo(formData, "geolocalizacao");
  let geolocalizacao = null;
  if (geoRaw) {
    try {
      geolocalizacao = JSON.parse(geoRaw);
    } catch {
      // Ignora erro de parse
    }
  }

  const token = gerarTokenColeta();
  const { data: resultado, error } = await supabase
    .rpc("inscrever_candidato", {
      p_slug: slug,
      p_nome: validacao.data.nomeCompleto,
      p_cpf: validacao.data.cpf,
      p_telefone: validacao.data.telefone,
      p_email: validacao.data.email,
      p_regiao_id: validacao.data.regiaoId,
      p_funcao: validacao.data.funcao,
      p_consentimento: true,
      p_token: token,
    })
    .maybeSingle<ResultadoInscrever>();

  if (error || !resultado) {
    return { status: "erro", mensagem: "Não foi possível concluir a inscrição. Tente de novo." };
  }
  if (resultado.erro || !resultado.token) {
    return { status: "erro", mensagem: MENSAGEM_ERRO[resultado.erro ?? ""] ?? "Não foi possível concluir a inscrição." };
  }

  // Registra auditoria da inscrição com IP e localização
  try {
    await supabase.rpc("registrar_auditoria_inscricao", {
      p_slug: slug,
      p_acao: "envio_autoinscricao",
      p_ip: ip,
      p_geolocalizacao: geolocalizacao,
      p_user_agent: userAgent,
      p_detalhes: {
        token: resultado.token,
        ja_existia: resultado.ja_existia,
        headers_geo: geoHeaders,
      },
    });
  } catch {
    // Auditoria não impede o redirecionamento
  }

  return { status: "sucesso", token: resultado.token, jaExistia: resultado.ja_existia };
}
