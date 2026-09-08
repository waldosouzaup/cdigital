/**
 * Conferência assistida da importação de planilha de cadastro — Fase 4, item 7.
 *
 * Lógica pura: classifica cada linha em `validos`, `duplicatas` (CPF repetido na
 * planilha OU já existente no banco) e `invalidos` — "documentos ilegíveis" no
 * texto do PROMPT, interpretado (decisão do usuário, registrada em CONSULTAS.md)
 * como linha que não passa: CPF que não fecha o dígito verificador, nome em
 * branco. A Server Action só grava depois que o coordenador vê este resultado e
 * confirma.
 */
import { isValidCpf, stripCpf } from "@/lib/documentos/cpf";

export interface LinhaPlanilha {
  linha: number;
  nomeCompleto: string;
  cpf: string;
  telefone?: string;
  regiao?: string;
  funcao?: string;
}

export interface LinhaClassificada extends LinhaPlanilha {
  cpfNormalizado: string;
  motivo?: string;
}

export interface ResultadoAnalise {
  validos: LinhaClassificada[];
  duplicatas: LinhaClassificada[];
  invalidos: LinhaClassificada[];
}

export function analisarLinhas(
  linhas: LinhaPlanilha[],
  cpfsExistentes: Set<string>,
): ResultadoAnalise {
  // Contagem de cada CPF (normalizado) dentro da própria planilha.
  const ocorrencias = new Map<string, number>();
  for (const l of linhas) {
    const norm = stripCpf(l.cpf ?? "");
    if (norm) ocorrencias.set(norm, (ocorrencias.get(norm) ?? 0) + 1);
  }

  const resultado: ResultadoAnalise = { validos: [], duplicatas: [], invalidos: [] };

  for (const l of linhas) {
    const cpfNormalizado = stripCpf(l.cpf ?? "");
    const base: LinhaClassificada = { ...l, cpfNormalizado };

    if (!l.nomeCompleto || !l.nomeCompleto.trim()) {
      resultado.invalidos.push({ ...base, motivo: "Nome em branco" });
      continue;
    }
    if (cpfNormalizado.length !== 11 || !isValidCpf(cpfNormalizado)) {
      resultado.invalidos.push({ ...base, motivo: "CPF inválido ou ilegível" });
      continue;
    }
    if ((ocorrencias.get(cpfNormalizado) ?? 0) > 1) {
      resultado.duplicatas.push({ ...base, motivo: "CPF repetido na planilha" });
      continue;
    }
    if (cpfsExistentes.has(cpfNormalizado)) {
      resultado.duplicatas.push({ ...base, motivo: "CPF já cadastrado na organização" });
      continue;
    }
    resultado.validos.push(base);
  }

  return resultado;
}
