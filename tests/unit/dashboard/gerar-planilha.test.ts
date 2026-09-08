import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { gerarXlsxNominal } from "@/lib/dashboard/gerar-planilha";

/**
 * Fase 3, item 7: "Exportação em XLSX (base nominal)." O gate exige que ela
 * "abra no Excel sem erro de fórmula" — o teste real disso é ler o arquivo de
 * volta com a mesma biblioteca que escreveu e comparar os valores, não só
 * checar a assinatura de arquivo.
 */
describe("gerarXlsxNominal", () => {
  it("produz um XLSX que abre de volta com os mesmos dados", async () => {
    const bytes = await gerarXlsxNominal([
      {
        nomeCompleto: "Ana Cláudia",
        cpf: "52998224725",
        funcao: "Militância",
        regiaoNome: "Águas Claras",
        apta: true,
        statusContrato: "assinado",
      },
      {
        nomeCompleto: "Bruno Silva",
        cpf: "11144477735",
        funcao: null,
        regiaoNome: null,
        apta: false,
        statusContrato: null,
      },
    ]);

    const assinatura = Buffer.from(bytes.slice(0, 2)).toString("hex");
    expect(assinatura).toBe("504b"); // "PK" — assinatura de arquivo ZIP/XLSX

    const workbook = new ExcelJS.Workbook();
    // Fricção de tipos entre a definição própria do exceljs para Buffer e a
    // versão de @types/node deste projeto (Buffer<ArrayBufferLike> genérico) —
    // sem efeito em tempo de execução, os bytes são os mesmos.
    await workbook.xlsx.load(Buffer.from(bytes) as never);
    const planilha = workbook.worksheets[0];

    expect(planilha.getRow(1).getCell(1).value).toBe("Nome Completo");
    expect(planilha.getRow(2).getCell(1).value).toBe("Ana Cláudia");
    expect(planilha.getRow(2).getCell(2).value).toBe("52998224725");
    expect(planilha.getRow(3).getCell(1).value).toBe("Bruno Silva");
    // Célula vazia (sem região) não pode ser uma fórmula quebrada nem "undefined" —
    // precisa ser texto legível ou nulo, nunca a string literal "undefined".
    expect(planilha.getRow(3).getCell(4).value).not.toBe("undefined");
  });
});
