/**
 * Validação da identidade do comitê (nome + CNPJ) — item 4 do feedback do
 * coordenador. Função pura; a Server Action `salvarIdentidadeComite` grava só
 * quando `ok`.
 */
import { formatCnpj, isValidCnpj } from "./cnpj";

export interface EntradaIdentidadeComite {
  nome: string;
  cnpj: string;
}

export interface ValoresIdentidadeComite {
  nome: string;
  cnpj: string | null;
}

export type CampoIdentidade = "nome" | "cnpj";

export type ResultadoIdentidade =
  | { ok: true; valores: ValoresIdentidadeComite }
  | { ok: false; erros: Partial<Record<CampoIdentidade, string>> };

const MAX_NOME = 120;

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

  if (Object.keys(erros).length > 0) return { ok: false, erros };
  return { ok: true, valores: { nome, cnpj } };
}
