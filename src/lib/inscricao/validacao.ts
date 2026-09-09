/**
 * Validação da autoinscrição pública (Feature B) — `/inscricao/[slug]`.
 *
 * Só valida forma (campos obrigatórios, CPF com dígito verificador, região/função
 * dentro das listas que a RPC `dados_inscricao_publica` devolveu, consentimento
 * marcado). A checagem de slug ativo e de a região pertencer à organização é da
 * RPC `inscrever_candidato`; a duplicata de CPF também é resolvida lá.
 */
import { z } from "zod";
import { isValidCpf, stripCpf } from "@/lib/documentos/cpf";

const FORMA_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const schemaBase = z.object({
  nomeCompleto: z.string().trim().min(1, "Informe o nome completo."),
  cpf: z
    .string()
    .trim()
    .transform(stripCpf)
    .refine((digits) => isValidCpf(digits), "CPF inválido — confira o dígito verificador."),
  telefone: z.string().trim().min(8, "Informe um telefone para contato."),
  email: z.string().trim().toLowerCase().regex(FORMA_EMAIL, "E-mail inválido."),
  regiaoId: z.string().trim().min(1, "Selecione a região."),
  funcao: z.string().trim().min(1, "Selecione a função."),
  consentimento: z.literal(true, { message: "É preciso aceitar o uso dos dados." }),
});

export type EntradaInscricao = z.infer<typeof schemaBase>;

export type ResultadoInscricao =
  | { success: true; data: EntradaInscricao }
  | { success: false; errors: Partial<Record<keyof EntradaInscricao, string>> };

export interface OpcoesInscricao {
  regioesIds: readonly string[];
  funcoes: readonly string[];
}

export function validarEntradaInscricao(
  entrada: unknown,
  opcoes: OpcoesInscricao,
): ResultadoInscricao {
  const schema = schemaBase
    .refine((d) => opcoes.regioesIds.includes(d.regiaoId), {
      path: ["regiaoId"],
      message: "Região não disponível para esta inscrição.",
    })
    .refine((d) => opcoes.funcoes.includes(d.funcao), {
      path: ["funcao"],
      message: "Função não disponível para esta inscrição.",
    });

  const resultado = schema.safeParse(entrada);
  if (resultado.success) {
    return { success: true, data: resultado.data };
  }

  const errors: Partial<Record<keyof EntradaInscricao, string>> = {};
  for (const issue of resultado.error.issues) {
    const campo = issue.path[0] as keyof EntradaInscricao;
    if (campo && !errors[campo]) errors[campo] = issue.message;
  }
  return { success: false, errors };
}
