import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";
import { validarImagemAssinatura, anexarEvidenciasPdf } from "@/lib/contratos/evidencias";
import { gerarPdfContrato } from "@/lib/contratos/gerar-pdf";
import { MODELO_REFERENCIA_MICHELLE } from "@/lib/contratos/modelo-referencia";
import { substituirMarcadores } from "@/lib/contratos/marcadores";

const imagem = (cor: string) =>
  sharp({ create: { width: 800, height: 260, channels: 3, background: cor } })
    .png()
    .toBuffer();
describe("Documento e evidências da assinatura", () => {
  it("rejeita arquivo disfarçado de imagem, assinatura em branco e foto sem detalhes", async () => {
    await expect(validarImagemAssinatura(Buffer.from("%PDF-invalid"), "foto")).rejects.toThrow();
    await expect(validarImagemAssinatura(await imagem("white"), "assinatura")).rejects.toThrow(
      "Desenhe",
    );
    await expect(validarImagemAssinatura(await imagem("black"), "foto")).rejects.toThrow(
      "sem detalhes",
    );
  });
  it("preserva o PDF original e acrescenta uma página com as duas imagens", async () => {
    const original = await gerarPdfContrato({ titulo: "Teste", corpo: "Cláusula original." });
    const saida = await anexarEvidenciasPdf({
      original,
      assinatura: await imagem("white"),
      foto: await imagem("red"),
      nome: "Pessoa teste",
      cpf: "00000000000",
      contratoId: "teste",
      registradoEm: "2026-09-10T12:00:00Z",
    });
    expect((await PDFDocument.load(saida)).getPageCount()).toBe(
      (await PDFDocument.load(original)).getPageCount() + 1,
    );
  });
  it("contém todas as cláusulas do modelo sem reutilizar dados do colaborador de referência", async () => {
    const texto = substituirMarcadores(MODELO_REFERENCIA_MICHELLE, {
      nome: "Pessoa Teste",
      cpf: "00000000000",
      endereco: "Endereço teste",
      objeto: "Administrativo",
      valor: "R$ 100,00",
      valorExtenso: "cem reais",
      vigenciaInicio: "10/09/2026",
      vigenciaFim: "30/09/2026",
      chavePix: "chave teste",
    });
    for (const clausula of [
      "Cláusula 1.",
      "Cláusula 6.",
      "Cláusula 7.1",
      "Cláusula 7.5",
      "Cláusula 8.",
    ])
      expect(texto).toContain(clausula);
    expect(texto).not.toMatch(/Abner|060\.418|Quadra 803|3\.553|\{\{/);
    expect(texto).toContain("Pessoa Teste");
    expect(texto).toContain("R$ 100,00");
    expect(
      (
        await PDFDocument.load(await gerarPdfContrato({ titulo: "Contrato", corpo: texto }))
      ).getPageCount(),
    ).toBeGreaterThan(1);
  });
});
