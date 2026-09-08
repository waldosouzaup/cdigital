/**
 * Validação do registro rápido de atividade de campo — Fase 4, item 1
 * ("registro de atividade em 3 toques"). Função pura: a Server Action
 * `registrarAtividade` chama isto, e só grava em `registros_atividade` se `ok`.
 *
 * `data` é comparada contra um `hoje` recebido por parâmetro (não `new Date()`
 * interno) para o teste ser determinístico e para o servidor poder passar o "hoje"
 * no fuso de Brasília.
 */
export interface EntradaRegistroAtividade {
  pessoaId: string;
  regiaoId?: string;
  tipo: string;
  quantidade: string | number;
  observacao?: string;
  data: string;
}

export interface ValoresRegistroAtividade {
  pessoaId: string;
  regiaoId: string | null;
  tipo: string;
  quantidade: number;
  observacao: string | null;
  data: string;
}

export type CampoRegistro = "pessoaId" | "tipo" | "quantidade" | "observacao" | "data";

export type ResultadoValidacao =
  | { ok: true; valores: ValoresRegistroAtividade }
  | { ok: false; erros: Partial<Record<CampoRegistro, string>> };

const MAX_TIPO = 80;
const MAX_OBSERVACAO = 500;

export function validarRegistroAtividade(
  entrada: EntradaRegistroAtividade,
  hojeIso: string,
): ResultadoValidacao {
  const erros: Partial<Record<CampoRegistro, string>> = {};

  const pessoaId = (entrada.pessoaId ?? "").trim();
  if (!pessoaId) {
    erros.pessoaId = "Escolha a pessoa que executou a atividade.";
  }

  const tipo = (entrada.tipo ?? "").trim();
  if (!tipo) {
    erros.tipo = "Escolha um tipo de atividade.";
  } else if (tipo.length > MAX_TIPO) {
    erros.tipo = `Use no máximo ${MAX_TIPO} caracteres.`;
  }

  const quantidadeBruta =
    typeof entrada.quantidade === "number" ? String(entrada.quantidade) : (entrada.quantidade ?? "").trim();
  const quantidade = Number(quantidadeBruta);
  if (!quantidadeBruta || !Number.isInteger(quantidade) || quantidade < 1) {
    erros.quantidade = "Informe um número inteiro maior que zero.";
  }

  const observacaoBruta = (entrada.observacao ?? "").trim();
  if (observacaoBruta.length > MAX_OBSERVACAO) {
    erros.observacao = `Use no máximo ${MAX_OBSERVACAO} caracteres.`;
  }

  const data = (entrada.data ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    erros.data = "Data inválida.";
  } else if (data > hojeIso) {
    erros.data = "A data não pode ser no futuro.";
  }

  if (Object.keys(erros).length > 0) {
    return { ok: false, erros };
  }

  return {
    ok: true,
    valores: {
      pessoaId,
      regiaoId: (entrada.regiaoId ?? "").trim() || null,
      tipo,
      quantidade,
      observacao: observacaoBruta || null,
      data,
    },
  };
}
