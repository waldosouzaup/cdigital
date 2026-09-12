/**
 * Leitura de templates de contrato — Fase 2, item 7. RLS do usuário (`server.ts`),
 * organização vem de graça da policy.
 */
import { createClient } from "@/lib/supabase/server";
import { normalizarRemetente } from "@/lib/notificacoes/remetente";
import { qualificacaoContratante } from "@/lib/contratos/contratante";
import {
  NOME_TEMPLATE_DISTRATO,
  TEMPLATE_DISTRATO_PADRAO,
} from "@/lib/contratos/template-distrato";
import {
  REMETENTE_PADRAO,
  remetenteConfigurado,
} from "@/lib/notificacoes/transporte-padrao";

export interface TemplateContrato {
  id: string;
  nome: string;
  objeto: string;
  corpoHtml: string;
  valorPadrao: string | null;
  ativo: boolean;
}

export interface IdentidadeComite {
  endereco: string | null;
  representanteNome: string | null;
  representanteCargo: string | null;
  qualificacaoContratante: string | null;
  /** Como a CONTRATANTE sai hoje nos contratos, já composta. */
  contratantePreview: string;
  nome: string;
  cnpj: string | null;
  /** Slug da URL pública `/inscricao/<slug>` (Feature B). */
  slug: string | null;
}

/** Identidade do comitê (nome + CNPJ + slug) da organização do usuário logado. */
export async function buscarIdentidadeComite(): Promise<IdentidadeComite> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organizacoes")
    .select(
      "nome, cnpj, slug, endereco, representante_nome, representante_cargo, qualificacao_contratante",
    )
    .maybeSingle();

  if (error) throw new Error("Não foi possível carregar a identidade do comitê.");

  return {
    nome: data?.nome ?? "",
    cnpj: data?.cnpj ?? null,
    slug: data?.slug ?? null,
    endereco: data?.endereco ?? null,
    representanteNome: data?.representante_nome ?? null,
    representanteCargo: data?.representante_cargo ?? null,
    qualificacaoContratante: data?.qualificacao_contratante ?? null,
    // A tela mostra o resultado, não os ingredientes: é este texto que sai
    // impresso no contrato e no termo de distrato.
    contratantePreview: qualificacaoContratante({
      nome: data?.nome ?? "",
      cnpj: data?.cnpj,
      endereco: data?.endereco,
      representanteNome: data?.representante_nome,
      representanteCargo: data?.representante_cargo,
      qualificacaoContratante: data?.qualificacao_contratante,
    }),
  };
}

export async function listarTemplates(): Promise<TemplateContrato[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("templates_contrato")
    .select("id, nome, objeto, corpo_html, valor_padrao, ativo")
    // O termo de distrato mora na mesma tabela (migration 0034) mas não é
    // opção de emissão: fica fora desta lista e tem tela própria.
    .eq("tipo", "contrato")
    .order("nome");

  if (error) throw new Error("Não foi possível carregar os modelos de contrato.");

  return (data ?? []).map((t) => ({
    id: t.id,
    nome: t.nome,
    objeto: t.objeto,
    corpoHtml: t.corpo_html,
    valorPadrao: t.valor_padrao,
    ativo: t.ativo,
  }));
}

export interface TemplateDistrato {
  id: string | null;
  nome: string;
  corpoHtml: string;
  /** true quando ainda não há modelo salvo e o texto exibido é o termo oficial de fábrica. */
  padrao: boolean;
}

/**
 * Modelo do termo de rescisão. Quando o comitê nunca salvou um, devolve o termo
 * oficial de fábrica — é exatamente o texto que a rescisão já gerava antes de a
 * edição existir, então a tela nunca abre vazia.
 */
export async function buscarTemplateDistrato(): Promise<TemplateDistrato> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("templates_contrato")
    .select("id, nome, corpo_html")
    .eq("tipo", "distrato")
    .maybeSingle();

  if (error) throw new Error("Não foi possível carregar o modelo de distrato.");

  if (!data) {
    return {
      id: null,
      nome: NOME_TEMPLATE_DISTRATO,
      corpoHtml: TEMPLATE_DISTRATO_PADRAO,
      padrao: true,
    };
  }

  return {
    id: data.id,
    nome: data.nome || NOME_TEMPLATE_DISTRATO,
    corpoHtml: data.corpo_html,
    padrao: false,
  };
}

export interface CampanhaSuperadmin {
  id: string;
  nome: string;
  cnpj: string | null;
  slug: string | null;
  ativa: boolean;
  criadoEm: string;
  gestores: { id: string; nome: string; email: string }[];
  totalMembros: number;
}

interface LinhaOrg {
  id: string;
  nome: string;
  cnpj: string | null;
  slug: string | null;
  ativa: boolean | null;
  criado_em: string;
}

interface LinhaUsuarioOrg {
  id: string;
  nome: string;
  email: string;
  papel: string;
  organizacao_id: string;
  ativo: boolean;
}

export async function listarCampanhasSuperadmin(): Promise<CampanhaSuperadmin[]> {
  const supabase = await createClient();
  const { data: orgs, error: erroOrgs } = await supabase
    .from("organizacoes")
    .select("id, nome, cnpj, slug, ativa, criado_em")
    .order("criado_em", { ascending: false })
    .returns<LinhaOrg[]>();

  if (erroOrgs || !orgs) return [];

  const { data: usuarios } = await supabase
    .from("usuarios")
    .select("id, nome, email, papel, organizacao_id, ativo")
    .returns<LinhaUsuarioOrg[]>();

  return orgs.map((org) => {
    const membrosDaOrg = (usuarios ?? []).filter((u) => u.organizacao_id === org.id);
    const gestores = membrosDaOrg
      .filter((u) => u.papel === "gestor" && u.ativo)
      .map((u) => ({ id: u.id, nome: u.nome, email: u.email }));

    return {
      id: org.id,
      nome: org.nome,
      cnpj: org.cnpj,
      slug: org.slug,
      ativa: org.ativa ?? true,
      criadoEm: org.criado_em,
      gestores,
      totalMembros: membrosDaOrg.length,
    };
  });
}

export interface MetricasComunicacao {
  apiKeyConfigurada: boolean;
  remetenteConfigurado: string;
  /** Remetente já normalizado, exatamente como sai para o Resend. */
  remetenteEfetivo: string | null;
  /** Motivo em português quando `RESEND_FROM` não é um endereço utilizável. */
  remetenteErro: string | null;
  appUrl: string;
  totalEnviadas: number;
  totalFalhas: number;
  totalEnfileiradas: number;
  ultimasNotificacoes: {
    id: string;
    tipo: string;
    destinatarioEmail: string;
    status: string;
    erro: string | null;
    tentativas: number;
    criadoEm: string;
  }[];
}

export async function obterMetricasComunicacao(): Promise<MetricasComunicacao> {
  const remetente = normalizarRemetente(remetenteConfigurado());
  const supabase = await createClient();

  const { data: notificacoes } = await supabase
    .from("notificacoes")
    .select("id, tipo, destinatario_email, status, erro, tentativas, criado_em")
    .order("criado_em", { ascending: false })
    .limit(10);

  const { count: enviadas } = await supabase
    .from("notificacoes")
    .select("id", { count: "exact", head: true })
    .eq("status", "enviada");

  const { count: falhas } = await supabase
    .from("notificacoes")
    .select("id", { count: "exact", head: true })
    .eq("status", "falhou");

  const { count: enfileiradas } = await supabase
    .from("notificacoes")
    .select("id", { count: "exact", head: true })
    .eq("status", "enfileirada");

  return {
    apiKeyConfigurada: Boolean(process.env.RESEND_API_KEY && process.env.RESEND_API_KEY.trim()),
    remetenteConfigurado: process.env.RESEND_FROM || `${REMETENTE_PADRAO} (padrão)`,
    // Conferido aqui para que uma RESEND_FROM malformada apareça nesta tela em
    // vez de só virar `notificacoes.erro` depois que o envio já falhou.
    remetenteEfetivo: remetente.ok ? remetente.valor : null,
    remetenteErro: remetente.ok ? null : remetente.mensagem,
    appUrl: process.env.APP_URL || "http://localhost:3000",
    totalEnviadas: enviadas ?? 0,
    totalFalhas: falhas ?? 0,
    totalEnfileiradas: enfileiradas ?? 0,
    ultimasNotificacoes: (notificacoes ?? []).map((n) => ({
      id: n.id,
      tipo: n.tipo,
      destinatarioEmail: n.destinatario_email,
      status: n.status,
      erro: n.erro,
      tentativas: n.tentativas,
      criadoEm: n.criado_em,
    })),
  };
}

