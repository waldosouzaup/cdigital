import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import { lerPlanilhaPessoas } from "@/lib/pessoas/ler-planilha";

/**
 * Fase 4, item 7 — leitura da planilha de cadastro. Mapeia cabeçalhos (sem
 * distinção de acento/caixa) para os campos de `LinhaPlanilha`. O número da linha
 * preservado é o da planilha (cabeçalho = 1), para a conferência apontar onde.
 */
async function planilha(linhas: (string | number)[][]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("cadastro");
  linhas.forEach((l) => ws.addRow(l));
  return Buffer.from(await wb.xlsx.writeBuffer());
}

describe("lerPlanilhaPessoas", () => {
  it("lê nome, CPF, telefone, região e função a partir dos cabeçalhos", async () => {
    const buf = await planilha([
      ["Nome Completo", "CPF", "Telefone", "Região", "Função"],
      ["Maria Aparecida", "123.456.789-09", "61990001111", "Gama", "Militância"],
    ]);
    const linhas = await lerPlanilhaPessoas(buf);
    expect(linhas).toEqual([
      {
        linha: 2,
        nomeCompleto: "Maria Aparecida",
        cpf: "123.456.789-09",
        telefone: "61990001111",
        regiao: "Gama",
        funcao: "Militância",
      },
    ]);
  });

  it("reconhece cabeçalhos com acento/caixa diferentes e a coluna 'nome'", async () => {
    const buf = await planilha([
      ["nome", "cpf"],
      ["João", "11122233344"],
    ]);
    const linhas = await lerPlanilhaPessoas(buf);
    expect(linhas[0]).toMatchObject({ linha: 2, nomeCompleto: "João", cpf: "11122233344" });
  });

  it("ignora linhas totalmente vazias", async () => {
    const buf = await planilha([
      ["nome", "cpf"],
      ["Ana", "1"],
      ["", ""],
      ["Bia", "2"],
    ]);
    const linhas = await lerPlanilhaPessoas(buf);
    expect(linhas.map((l) => l.linha)).toEqual([2, 4]);
  });

  it("converte CPF numérico da célula para texto", async () => {
    const buf = await planilha([
      ["nome", "cpf"],
      ["Zé", 12345678909],
    ]);
    const linhas = await lerPlanilhaPessoas(buf);
    expect(linhas[0].cpf).toBe("12345678909");
  });

  it("lança erro claro quando não há coluna de nome nem de CPF", async () => {
    const buf = await planilha([
      ["coluna_a", "coluna_b"],
      ["x", "y"],
    ]);
    await expect(lerPlanilhaPessoas(buf)).rejects.toThrow(/cabeçalho/i);
  });
});
