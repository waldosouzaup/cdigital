/**
 * Validação de entrada para cadastro/edição de pessoa — Fase 2, item 1.
 *
 * Só valida forma (campo obrigatório presente, CPF com dígito verificador correto).
 * Não decide duplicata — isso depende de consultar o banco por organização (Seção 5:
 * índice único `(organizacao_id, cpf)`) e é responsabilidade de quem chama esta função
 * (a Server Action em `acoes.ts`), não desta validação pura.
 */
import { z } from "zod";
import { isValidCpf, stripCpf } from "@/lib/documentos/cpf";

const schema = z.object({
  fullName: z.string().trim().min(1, "Informe o nome completo."),
  cpf: z
    .string()
    .trim()
    .transform(stripCpf)
    .refine((digits) => isValidCpf(digits), "CPF inválido — confira o dígito verificador."),
  phone: z.string().trim().optional().default(""),
  regionId: z.string().trim().min(1, "Selecione uma região."),
  role: z.string().trim().optional().default(""),
});

export type EntradaPessoa = z.infer<typeof schema>;

export type ResultadoValidacao =
  | { success: true; data: EntradaPessoa }
  | { success: false; errors: Partial<Record<keyof EntradaPessoa, string>> };

export function validarEntradaPessoa(entrada: unknown): ResultadoValidacao {
  const resultado = schema.safeParse(entrada);
  if (resultado.success) {
    return { success: true, data: resultado.data };
  }

  const errors: Partial<Record<keyof EntradaPessoa, string>> = {};
  for (const issue of resultado.error.issues) {
    const campo = issue.path[0] as keyof EntradaPessoa;
    if (campo && !errors[campo]) errors[campo] = issue.message;
  }
  return { success: false, errors };
}

// ---------------------------------------------------------------------------
// Validação ampliada para Edição Completa (CRUD de Pessoas)
// ---------------------------------------------------------------------------

const schemaEdicao = z.object({
  id: z.string().trim().min(1, "Identificador da pessoa é obrigatório."),
  fullName: z.string().trim().min(1, "Informe o nome completo."),
  cpf: z
    .string()
    .trim()
    .transform(stripCpf)
    .refine((digits) => isValidCpf(digits), "CPF inválido — confira o dígito verificador."),
  rg: z.string().trim().optional().default(""),
  birthDate: z
    .string()
    .trim()
    .refine(
      (val) => !val || /^\d{4}-\d{2}-\d{2}$/.test(val),
      "Data de nascimento deve estar no formato AAAA-MM-DD.",
    )
    .optional()
    .default(""),
  phone: z.string().trim().optional().default(""),
  email: z
    .string()
    .trim()
    .refine(
      (val) => !val || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val),
      "E-mail com formato inválido.",
    )
    .optional()
    .default(""),
  regionId: z.string().trim().min(1, "Selecione uma região."),
  role: z.string().trim().optional().default(""),
  zipCode: z.string().trim().optional().default(""),
  address: z.string().trim().optional().default(""),
  pixKey: z.string().trim().optional().default(""),
  eligible: z.boolean().optional().default(false),
});

export type EntradaEdicaoPessoa = z.infer<typeof schemaEdicao>;

export type ResultadoValidacaoEdicao =
  | { success: true; data: EntradaEdicaoPessoa }
  | { success: false; errors: Partial<Record<keyof EntradaEdicaoPessoa, string>> };

export function validarEdicaoPessoa(entrada: unknown): ResultadoValidacaoEdicao {
  const resultado = schemaEdicao.safeParse(entrada);
  if (resultado.success) {
    return { success: true, data: resultado.data };
  }

  const errors: Partial<Record<keyof EntradaEdicaoPessoa, string>> = {};
  for (const issue of resultado.error.issues) {
    const campo = issue.path[0] as keyof EntradaEdicaoPessoa;
    if (campo && !errors[campo]) errors[campo] = issue.message;
  }
  return { success: false, errors };
}
