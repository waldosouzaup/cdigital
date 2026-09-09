/**
 * Validação da identidade do comitê (nome + CNPJ + slug público) — item 4 do
 * feedback do coordenador e Feature B (autoinscrição). Função pura; a Server Action
 * `salvarIdentidadeComite` grava só quando `ok`.
 */
import { formatCnpj, isValidCnpj } from "./cnpj";

export interface EntradaIdentidadeComite {
  nome: string;
  cnpj: string;
  /** Slug da URL pública `/inscricao/<slug>`. Vazio limpa o slug. */
  slug?: string;
}

export interface ValoresIdentidadeComite {
  nome: string;
  cnpj: string | null;
  slug: string | null;
}

export type CampoIdentidade = "nome" | "cnpj" | "slug";

export type ResultadoIdentidade =
  | { ok: true; valores: ValoresIdentidadeComite }
  | { ok: false; erros: Partial<Record<CampoIdentidade, string>> };

const MAX_NOME = 120;
const SLUG_MIN = 3;
const SLUG_MAX = 40;

/** Sugestão de slug a partir de um texto livre (ex.: o nome do comitê). */
export function slugify(texto: string): string {
  return (texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX);
}

/** `null` = válido (vazio limpa); string = mensagem de erro. */
export function validarSlug(slugBruto: string): string | null {
  const slug = (slugBruto ?? "").trim().toLowerCase();
  if (!slug) return null;
  if (slug.length < SLUG_MIN || slug.length > SLUG_MAX) {
    return `O endereço deve ter de ${SLUG_MIN} a ${SLUG_MAX} caracteres.`;
  }
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return "Use só letras minúsculas, números e hífen.";
  }
  if (slug.startsWith("-") || slug.endsWith("-") || slug.includes("--")) {
    return "O hífen não pode ficar no início/fim nem repetido.";
  }
  return null;
}

export function validarIdentidadeComite(
  entrada: EntradaIdentidadeComite,
): ResultadoIdentidade {
  const erros: Partial<Record<CampoIdentidade, string>> = {};

  const nome = (entrada.nome ?? "").trim().replace(/\s+/g, " ");
  if (!nome) {
    erros.nome = "Informe o nome do comitê.";
  } else if (nome.length > MAX_NOME) {
    erros.nome = `Use no máximo ${MAX_NOME} caracteres.`;
  }

  const cnpjBruto = (entrada.cnpj ?? "").trim();
  let cnpj: string | null = null;
  if (cnpjBruto) {
    if (!isValidCnpj(cnpjBruto)) {
      erros.cnpj = "CNPJ inválido — confira o dígito verificador.";
    } else {
      cnpj = formatCnpj(cnpjBruto);
    }
  }

  const slugBruto = (entrada.slug ?? "").trim().toLowerCase();
  const erroSlug = validarSlug(slugBruto);
  if (erroSlug) erros.slug = erroSlug;

  if (Object.keys(erros).length > 0) return { ok: false, erros };
  return { ok: true, valores: { nome, cnpj, slug: slugBruto || null } };
}
