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
import { gerarTokenColeta } from "@/lib/coleta/token";
import { renderizarEmailLinkColeta } from "@/emails/link-coleta";
import { sendNotification } from "@/lib/notificacoes/enviar";
import { idempotencyKey } from "@/lib/notificacoes/chave-idempotencia";
import { createResendTransport } from "@/lib/notificacoes/transporte";

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
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims as Record<string, unknown> | undefined;
  const organizationId = claims?.organizacao_id as string | undefined;

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
  const transporte = createResendTransport(
    process.env.RESEND_API_KEY ?? "",
    process.env.RESEND_FROM ?? "Comitê Digital <nao-responda@exemplo.invalid>",
  );

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
