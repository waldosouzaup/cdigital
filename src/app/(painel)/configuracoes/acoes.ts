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
import {
  documentosParaExpurgo,
  dataLiberacaoExpurgo,
  CARENCIA_PADRAO_DIAS,
} from "@/lib/documentos/elegiveis-expurgo";

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

/**
 * Fase 4, item 6 — expurgo de documentos pessoais ao fim da campanha.
 *
 * Só gestor. "Fim da campanha" = maior `vigencia_fim` entre os contratos da
 * organização; a carência (retenção legal/fiscal) some a isso. Para cada
 * documento elegível: registra o expurgo e marca a linha (RPC atômica), depois
 * apaga o objeto no Storage. A ordem (registrar antes de apagar) garante que
 * nunca haja arquivo apagado sem registro.
 */
export async function expurgarDocumentosDaCampanha(
  motivo: string,
  carenciaDias: number = CARENCIA_PADRAO_DIAS,
): Promise<{
  status: "ok" | "erro";
  expurgados?: number;
  falhas?: number;
  mensagem?: string;
}> {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims as Record<string, unknown> | undefined;
  const organizationId = claims?.organizacao_id as string | undefined;

  if (!organizationId) return { status: "erro", mensagem: "Sessão inválida — faça login de novo." };
  if (claims?.papel !== "gestor") {
    return { status: "erro", mensagem: "Só o gestor pode executar o expurgo de retenção." };
  }
  if (!motivo.trim()) {
    return { status: "erro", mensagem: "Informe o motivo do expurgo (fica registrado)." };
  }

  const { data: contrato } = await supabase
    .from("contratos")
    .select("vigencia_fim")
    .order("vigencia_fim", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!contrato?.vigencia_fim) {
    return { status: "erro", mensagem: "Sem contratos — o fim da campanha não está definido." };
  }
  const fimCampanha = contrato.vigencia_fim as string;

  const { data: docs } = await supabase
    .from("documentos")
    .select("id, caminho_storage, criado_em, expurgado_em");

  const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const elegiveis = documentosParaExpurgo(
    (docs ?? []).map((d) => ({
      id: d.id,
      criadoEm: d.criado_em,
      expurgadoEm: d.expurgado_em,
    })),
    fimCampanha,
    carenciaDias,
    hoje,
  );

  if (elegiveis.length === 0) {
    return {
      status: "ok",
      expurgados: 0,
      falhas: 0,
      mensagem: `Retenção até ${dataLiberacaoExpurgo(fimCampanha, carenciaDias)} — nada a expurgar ainda.`,
    };
  }

  let expurgados = 0;
  let falhas = 0;
  for (const id of elegiveis) {
    const doc = (docs ?? []).find((d) => d.id === id);
    const { error } = await supabase.rpc("registrar_expurgo_documento", {
      p_documento_id: id,
      p_motivo: motivo.trim(),
    });
    if (error) {
      falhas += 1;
      continue;
    }
    if (doc?.caminho_storage) {
      await supabase.storage.from("documentos").remove([doc.caminho_storage]);
    }
    expurgados += 1;
  }

  revalidatePath("/documentos");
  return { status: "ok", expurgados, falhas };
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
