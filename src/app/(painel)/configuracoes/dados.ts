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
