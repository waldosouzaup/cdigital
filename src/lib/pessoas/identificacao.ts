/**
 * Identificação da pessoa contratada — física por CPF, jurídica por CNPJ
 * (migration 0042).
 *
 * `pessoas.cpf` era NOT NULL, então não cabia subcontratado PJ. Isso barrava
 * construção civil por inteiro e também produtora terceirizada em evento.
 *
 * Espelha a restrição `pessoas_identificacao_coerente` do banco. Espelhar, em
 * vez de confiar só no banco, é o que permite devolver mensagem em português no
 * formulário em vez de deixar vazar um erro 23514 de violação de CHECK.
 *
 * Função pura: não consulta duplicata — isso depende do índice único por
 * organização e é responsabilidade de quem chama.
 */
import { isValidCpf, stripCpf } from "@/lib/documentos/cpf";
import { isValidCnpj, stripCnpj } from "@/lib/organizacao/cnpj";

export type TipoPessoa = "fisica" | "juridica";

export interface EntradaIdentificacao {
  tipoPessoa?: string | null;
  cpf?: string | null;
  cnpj?: string | null;
}

export interface ValoresIdentificacao {
  tipoPessoa: TipoPessoa;
  cpf: string | null;
  cnpj: string | null;
}

export type ErroIdentificacao = "tipoPessoa" | "cpf" | "cnpj";

export type ResultadoIdentificacao =
  | { ok: true; valores: ValoresIdentificacao }
  | { ok: false; erros: Partial<Record<ErroIdentificacao, string>> };

export function validarIdentificacao(entrada: EntradaIdentificacao): ResultadoIdentificacao {
  // Ausente é física: é o que as linhas já existentes são, e o que um formulário
  // antigo continua enviando.
  const tipoBruto = (entrada.tipoPessoa ?? "fisica").trim() || "fisica";

  if (tipoBruto !== "fisica" && tipoBruto !== "juridica") {
    return {
      ok: false,
      erros: { tipoPessoa: "Escolha se o contratado é pessoa física ou jurídica." },
    };
  }
  const tipoPessoa: TipoPessoa = tipoBruto;

  if (tipoPessoa === "fisica") {
    const cpf = stripCpf((entrada.cpf ?? "").trim());
    if (!cpf) return { ok: false, erros: { cpf: "Informe o CPF." } };
    if (!isValidCpf(cpf)) {
      return { ok: false, erros: { cpf: "CPF inválido — confira o dígito verificador." } };
    }
    // O documento do outro tipo é descartado, não gravado: o CHECK do banco
    // recusaria a linha inteira se os dois viessem preenchidos.
    return { ok: true, valores: { tipoPessoa, cpf, cnpj: null } };
  }

  const cnpj = stripCnpj((entrada.cnpj ?? "").trim());
  if (!cnpj) return { ok: false, erros: { cnpj: "Informe o CNPJ." } };
  if (!isValidCnpj(cnpj)) {
    return { ok: false, erros: { cnpj: "CNPJ inválido — confira o dígito verificador." } };
  }

  return { ok: true, valores: { tipoPessoa, cpf: null, cnpj } };
}
