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
