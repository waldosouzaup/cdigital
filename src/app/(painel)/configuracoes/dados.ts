/**
 * Leitura de templates de contrato — Fase 2, item 7. RLS do usuário (`server.ts`),
 * organização vem de graça da policy.
 */
import { createClient } from "@/lib/supabase/server";

export interface TemplateContrato {
  id: string;
  nome: string;
  objeto: string;
  corpoHtml: string;
  valorPadrao: string | null;
  ativo: boolean;
}

export interface IdentidadeComite {
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
    .select("nome, cnpj, slug")
    .maybeSingle();

  if (error) throw new Error("Não foi possível carregar a identidade do comitê.");
  return { nome: data?.nome ?? "", cnpj: data?.cnpj ?? null, slug: data?.slug ?? null };
}

export async function listarTemplates(): Promise<TemplateContrato[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("templates_contrato")
    .select("id, nome, objeto, corpo_html, valor_padrao, ativo")
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

