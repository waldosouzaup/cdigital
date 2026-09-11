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
import { obterContextoUsuario } from "@/lib/supabase/contexto-usuario";
import { registerPersonWrite } from "@/lib/auditoria/registrar";
import { validarEntradaPessoa, validarEdicaoPessoa } from "@/lib/pessoas/validacao";
import { gerarTokenColeta } from "@/lib/coleta/token";
import { renderizarEmailLinkColeta } from "@/emails/link-coleta";
import { sendNotification } from "@/lib/notificacoes/enviar";
import { idempotencyKey } from "@/lib/notificacoes/chave-idempotencia";
import { transporteEmailPadrao } from "@/lib/notificacoes/transporte-padrao";
import type { EstadoCriarPessoa } from "./estado";

export interface ResultadoAcaoPessoa {
  ok: boolean;
  mensagem: string;
  errors?: Record<string, string>;
  duplicada?: boolean;
}

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
  const { organizationId, userId } = await obterContextoUsuario(supabase);

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

// ---------------------------------------------------------------------------
// Link público de coleta — Fase 2, item 2
// ---------------------------------------------------------------------------

export interface EstadoGerarLinkColeta {
  status: "sucesso" | "erro";
  url?: string;
  emailEnviado?: boolean;
  mensagem?: string;
}

const VALIDADE_PADRAO_DIAS = 7;

/**
 * Gera um link de coleta para uma pessoa já cadastrada. Quem chama é sempre um
 * usuário autenticado do painel (gestor/coord_comite/coord_regiao — a policy de
 * `links_coleta` já restringe isso); a validação do lado de quem RECEBE o link, sem
 * login, é feita pelas funções SECURITY DEFINER da migration 0005, não aqui.
 */
export async function gerarLinkColeta(
  pessoaId: string,
  diasValidade: number = VALIDADE_PADRAO_DIAS,
): Promise<EstadoGerarLinkColeta> {
  const supabase = await createClient();
  const { organizationId } = await obterContextoUsuario(supabase);

  if (!organizationId) {
    return { status: "erro", mensagem: "Sessão inválida — faça login novamente." };
  }

  const { data: pessoa } = await supabase
    .from("pessoas")
    .select("nome_completo, email")
    .eq("id", pessoaId)
    .maybeSingle();

  if (!pessoa) {
    return { status: "erro", mensagem: "Pessoa não encontrada." };
  }

  const token = gerarTokenColeta();
  const expiraEm = new Date(Date.now() + diasValidade * 24 * 60 * 60 * 1000);

  const { data: link, error } = await supabase
    .from("links_coleta")
    .insert({
      organizacao_id: organizationId,
      pessoa_id: pessoaId,
      token,
      expira_em: expiraEm.toISOString(),
    })
    .select("id")
    .single();

  if (error || !link) {
    return { status: "erro", mensagem: "Não foi possível gerar o link de coleta." };
  }

  const baseUrl = process.env.APP_URL || "http://localhost:3000";
  const url = `${baseUrl}/coleta/${token}`;

  // Sem e-mail cadastrado ainda não há para quem enviar — o link é devolvido do
  // mesmo jeito, para cópia manual (o coordenador pode mandar por WhatsApp).
  if (!pessoa.email) {
    return { status: "sucesso", url, emailEnviado: false };
  }

  const primeiroNome = pessoa.nome_completo.split(" ")[0];
  const { subject, html, text } = await renderizarEmailLinkColeta({
    primeiroNome,
    url,
    prazoDias: diasValidade,
  });

  // Sem domínio verificado no Resend (decisão registrada em CONSULTAS.md/PROGRESSO),
  // este envio real falha hoje — mas fica gravado em `notificacoes` como `falhou`,
  // não derruba a geração do link (Seção 6, regra 3), e o teste de idempotência
  // (chave determinística por link) segue válido independente disso.
  const transporte = transporteEmailPadrao();

  const resultadoEnvio = await sendNotification({
    supabase,
    transport: transporte,
    organizationId,
    type: "link_coleta",
    recipientEmail: pessoa.email,
    entity: "links_coleta",
    entityId: link.id,
    idempotencyKey: idempotencyKey("link_coleta", link.id),
    subject,
    html,
    text,
  });

  return { status: "sucesso", url, emailEnviado: resultadoEnvio.sent };
}

// ---------------------------------------------------------------------------
// Atualização de Pessoa — CRUD Completo
// ---------------------------------------------------------------------------

export async function atualizarPessoa(formData: FormData): Promise<ResultadoAcaoPessoa> {
  const resultado = validarEdicaoPessoa({
    id: campoTexto(formData, "id"),
    fullName: campoTexto(formData, "fullName"),
    cpf: campoTexto(formData, "cpf"),
    rg: campoTexto(formData, "rg"),
    birthDate: campoTexto(formData, "birthDate"),
    phone: campoTexto(formData, "phone"),
    email: campoTexto(formData, "email"),
    regionId: campoTexto(formData, "regionId"),
    role: campoTexto(formData, "role"),
    zipCode: campoTexto(formData, "zipCode"),
    address: campoTexto(formData, "address"),
    pixKey: campoTexto(formData, "pixKey"),
    eligible: formData.get("eligible") === "true" || formData.get("eligible") === "on",
  });

  if (!resultado.success) {
    return {
      ok: false,
      mensagem: "Verifique os dados informados nos campos assinalados.",
      errors: resultado.errors as Record<string, string>,
    };
  }

  const supabase = await createClient();
  const { organizationId, userId, papel } = await obterContextoUsuario(supabase);

  if (!organizationId) {
    return { ok: false, mensagem: "Sessão inválida — faça login novamente." };
  }

  const papeisPermitidos = ["gestor", "coord_comite", "superadmin"];
  if (!papeisPermitidos.includes(papel ?? "")) {
    return { ok: false, mensagem: "Apenas gestores ou administradores podem alterar cadastros." };
  }

  // Verifica se o CPF alterado já pertence a OUTRO colaborador na mesma organização
  const { data: existente } = await supabase
    .from("pessoas")
    .select("id, nome_completo")
    .eq("organizacao_id", organizationId)
    .eq("cpf", resultado.data.cpf)
    .neq("id", resultado.data.id)
    .maybeSingle();

  if (existente) {
    return {
      ok: false,
      duplicada: true,
      mensagem: `Já existe outro colaborador cadastrado com este CPF: ${existente.nome_completo}.`,
    };
  }

  const { error: erroUpdate } = await supabase
    .from("pessoas")
    .update({
      nome_completo: resultado.data.fullName,
      cpf: resultado.data.cpf,
      rg: resultado.data.rg || null,
      data_nascimento: resultado.data.birthDate || null,
      telefone: resultado.data.phone || null,
      email: resultado.data.email || null,
      regiao_id: resultado.data.regionId,
      funcao: resultado.data.role || null,
      cep: resultado.data.zipCode || null,
      endereco: resultado.data.address || null,
      chave_pix: resultado.data.pixKey || null,
      apta: resultado.data.eligible,
      atualizado_em: new Date().toISOString(),
    })
    .eq("id", resultado.data.id)
    .eq("organizacao_id", organizationId);

  if (erroUpdate) {
    if (erroUpdate.code === "23505") {
      return {
        ok: false,
        duplicada: true,
        mensagem: "Já existe outro colaborador com este CPF.",
      };
    }
    return { ok: false, mensagem: "Não foi possível atualizar o cadastro do colaborador." };
  }

  await registerPersonWrite({
    supabase,
    organizationId,
    userId,
    personId: resultado.data.id,
    action: "edicao",
  });

  revalidatePath("/pessoas");
  revalidatePath("/dashboard");
  return { ok: true, mensagem: "Colaborador atualizado com sucesso." };
}

// ---------------------------------------------------------------------------
// Exclusão de Pessoa com Auditoria em DadosExcluidos — CRUD Completo
// ---------------------------------------------------------------------------

export async function excluirPessoa(pessoaId: string, motivo?: string): Promise<ResultadoAcaoPessoa> {
  const supabase = await createClient();
  const { organizationId, userId, papel } = await obterContextoUsuario(supabase);

  if (!organizationId || !userId) {
    return { ok: false, mensagem: "Sessão inválida — faça login novamente." };
  }

  const papeisPermitidos = ["gestor", "coord_comite", "superadmin"];
  if (!papeisPermitidos.includes(papel ?? "")) {
    return { ok: false, mensagem: "Apenas gestores ou administradores podem excluir colaboradores." };
  }

  if (!pessoaId) {
    return { ok: false, mensagem: "Colaborador não informado." };
  }

  // 1. Busca todos os dados e dependências do colaborador
  const { data: pessoa } = await supabase
    .from("pessoas")
    .select("*, contratos ( id, status, criado_em ), documentos ( id, tipo, status, versao )")
    .eq("id", pessoaId)
    .eq("organizacao_id", organizationId)
    .maybeSingle();

  if (!pessoa) {
    return { ok: false, mensagem: "Colaborador não encontrado ou já excluído." };
  }

  // 2. Trava de segurança: impede exclusão se houver contratos em andamento
  const contratosLista = (pessoa.contratos as { id: string; status: string }[]) ?? [];
  const contratosAtivos = contratosLista.filter(
    (c) => !["cancelado", "distrato_assinado"].includes(c.status),
  );

  if (contratosAtivos.length > 0) {
    return {
      ok: false,
      mensagem: `Não é possível excluir este colaborador pois ele possui ${contratosAtivos.length} contrato(s) ativo(s) ou em andamento. Cancele ou distrate os contratos vinculados antes de excluir.`,
    };
  }

  // 3. Captura informações do usuário executor para arquivamento
  const { data: usuario } = await supabase
    .from("usuarios")
    .select("nome, email")
    .eq("id", userId)
    .maybeSingle();

  const usuarioNome = usuario?.nome || "Gestor do Comitê";
  const usuarioLogin = usuario?.email || "gestor@sistema";

  // 4. Grava snapshot completo em dados_excluidos (auditoria contábil / LGPD)
  const { error: erroAudit } = await supabase.from("dados_excluidos").insert({
    organizacao_id: organizationId,
    tipo_registro: "pessoa",
    registro_id: pessoaId,
    dados: pessoa,
    usuario_id: userId,
    usuario_nome: usuarioNome,
    usuario_login: usuarioLogin,
    motivo: motivo?.trim() || "Exclusão de colaborador pelo painel administrativo",
  });

  if (erroAudit) {
    console.error("Erro ao arquivar colaborador em dados_excluidos:", erroAudit);
    return {
      ok: false,
      mensagem: "Não foi possível registrar o arquivamento de auditoria antes da exclusão.",
    };
  }

  // 5. Remove vínculos auxiliares que impediriam a exclusão
  await supabase.from("links_coleta").delete().eq("pessoa_id", pessoaId);
  if (contratosLista.length === 0) {
    await supabase.from("documentos").delete().eq("pessoa_id", pessoaId);
    await supabase.from("atividades_campo").delete().eq("pessoa_id", pessoaId);
  }

  // 6. Remove o colaborador
  const { error: erroDelete } = await supabase
    .from("pessoas")
    .delete()
    .eq("id", pessoaId)
    .eq("organizacao_id", organizationId);

  if (erroDelete) {
    return {
      ok: false,
      mensagem: `Erro ao excluir colaborador: ${erroDelete.message}`,
    };
  }

  // 7. Registra no log de auditoria
  await registerPersonWrite({
    supabase,
    organizationId,
    userId,
    personId: pessoaId,
    action: "exclusao",
  });

  revalidatePath("/pessoas");
  revalidatePath("/dashboard");
  return {
    ok: true,
    mensagem: `Colaborador "${pessoa.nome_completo}" excluído e arquivado com sucesso.`,
  };
}

