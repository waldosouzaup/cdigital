import { describe, it, expect } from "vitest";
import { analisarLinhas, type LinhaPlanilha } from "@/lib/pessoas/analisar-planilha";
import { generateValidCpf } from "@/lib/documentos/cpf";

/**
 * Fase 4, item 7 — "conferência assistida que sinaliza duplicatas e documentos
 * ilegíveis antes de gravar". Lógica pura: classifica cada linha da planilha em
 * `validos`, `duplicatas` (repetida na planilha OU já no banco) e `invalidos`
 * (CPF que não fecha o dígito verificador, nome em branco).
 *
 * Gate: "Importação de planilha com 2 CPFs repetidos sinaliza os 2 antes de gravar."
 */
const cpfA = generateValidCpf("11122233");
const cpfB = generateValidCpf("44455566");
const cpfC = generateValidCpf("77788899");

function linha(over: Partial<LinhaPlanilha> & { linha: number }): LinhaPlanilha {
  return { nomeCompleto: "Fulano de Tal", cpf: cpfA, ...over };
}

describe("analisarLinhas", () => {
  it("aceita linhas bem preenchidas e sem conflito", () => {
    const r = analisarLinhas(
      [linha({ linha: 2, cpf: cpfA }), linha({ linha: 3, cpf: cpfB, nomeCompleto: "Beltrana" })],
      new Set(),
    );
    expect(r.validos.map((l) => l.linha)).toEqual([2, 3]);
    expect(r.duplicatas).toEqual([]);
    expect(r.invalidos).toEqual([]);
  });

  it("sinaliza AS DUAS linhas de um CPF repetido na planilha", () => {
    const r = analisarLinhas(
      [
        linha({ linha: 2, cpf: cpfA, nomeCompleto: "José" }),
        linha({ linha: 5, cpf: cpfB, nomeCompleto: "Maria" }),
        linha({ linha: 9, cpf: cpfA, nomeCompleto: "José (de novo)" }),
      ],
      new Set(),
    );
    expect(r.duplicatas.map((l) => l.linha).sort()).toEqual([2, 9]);
    expect(r.validos.map((l) => l.linha)).toEqual([5]);
  });

  it("marca como duplicata quem já existe no banco", () => {
    const r = analisarLinhas([linha({ linha: 2, cpf: cpfC })], new Set([cpfC.replace(/\D/g, "")]));
    expect(r.duplicatas).toHaveLength(1);
    expect(r.duplicatas[0].motivo).toMatch(/já cadastrad/i);
  });

  it("classifica como inválida ('ilegível') a linha com CPF que não fecha o dígito", () => {
    const r = analisarLinhas([linha({ linha: 2, cpf: "111.111.111-11" })], new Set());
    expect(r.invalidos).toHaveLength(1);
    expect(r.invalidos[0].motivo).toMatch(/cpf/i);
  });

  it("classifica como inválida a linha sem nome", () => {
    const r = analisarLinhas([linha({ linha: 2, nomeCompleto: "   ", cpf: cpfA })], new Set());
    expect(r.invalidos).toHaveLength(1);
    expect(r.invalidos[0].motivo).toMatch(/nome/i);
  });

  it("checa nome/CPF inválido antes de checar duplicidade", () => {
    const r = analisarLinhas(
      [
        linha({ linha: 2, cpf: "000.000.000-00" }),
        linha({ linha: 3, cpf: "000.000.000-00" }),
      ],
      new Set(),
    );
    expect(r.invalidos.map((l) => l.linha)).toEqual([2, 3]);
    expect(r.duplicatas).toEqual([]);
  });

  it("aceita CPF com e sem máscara como o mesmo valor", () => {
    const semMascara = cpfA.replace(/\D/g, "");
    const r = analisarLinhas(
      [linha({ linha: 2, cpf: cpfA }), linha({ linha: 3, cpf: semMascara })],
      new Set(),
    );
    expect(r.duplicatas.map((l) => l.linha).sort()).toEqual([2, 3]);
  });
});
