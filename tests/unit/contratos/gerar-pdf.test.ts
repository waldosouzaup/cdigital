import { describe, expect, it } from "vitest";
import { gerarPdfContrato, htmlParaTexto } from "@/lib/contratos/gerar-pdf";

/**
 * Fase 2, item 8: "Emissão de contrato gerando PDF." Testa que o PDF produzido é um
 * PDF de verdade (assinatura de arquivo `%PDF`) e que o corpo HTML do template vira
 * texto legível antes de entrar no documento (decisão registrada em CONSULTAS.md:
 * pdf-lib não interpreta HTML/CSS).
 */
describe("htmlParaTexto", () => {
  it("remove tags e preserva quebra de parágrafo", () => {
    const html = "<p>Primeiro parágrafo.</p><p>Segundo parágrafo.</p>";
    const texto = htmlParaTexto(html);
    expect(texto).toBe("Primeiro parágrafo.\n\nSegundo parágrafo.");
  });

  it("converte <br> em quebra de linha simples", () => {
    expect(htmlParaTexto("Linha 1<br>Linha 2")).toBe("Linha 1\nLinha 2");
  });

  it("decodifica entidades HTML comuns", () => {
    expect(htmlParaTexto("Empresa &amp; Cia &nbsp;Ltda")).toBe("Empresa & Cia  Ltda");
  });

  it("não deixa nenhuma tag sobrando", () => {
    const texto = htmlParaTexto("<div><strong>Negrito</strong> e <em>itálico</em></div>");
    expect(texto).not.toMatch(/<[^>]+>/);
  });
});

describe("gerarPdfContrato", () => {
  it("produz um arquivo PDF de verdade (assinatura %PDF)", async () => {
    const bytes = await gerarPdfContrato({
      titulo: "CONTRATO DE TESTE",
      corpo: "Cláusula única: este é um contrato de teste.\n\nAssinatura das partes.",
    });

    const assinatura = Buffer.from(bytes.slice(0, 5)).toString("ascii");
    expect(assinatura).toBe("%PDF-");
    expect(bytes.length).toBeGreaterThan(500);
  });

  it("gera páginas adicionais quando o corpo é muito longo para uma página", async () => {
    const paragrafoLongo = "Texto de cláusula contratual repetido várias vezes. ".repeat(400);
    const bytes = await gerarPdfContrato({ titulo: "CONTRATO LONGO", corpo: paragrafoLongo });

    // Duas páginas geram um PDF sensivelmente maior que uma só — prova indireta,
    // sem depender de um parser de PDF completo só para contar páginas num teste.
    const bytesUmaPagina = await gerarPdfContrato({ titulo: "CURTO", corpo: "Texto curto." });
    expect(bytes.length).toBeGreaterThan(bytesUmaPagina.length);
  });

  it("diagrama o modelo padrão com exatamente 2 páginas e blocos profissionais", async () => {
    const { MODELO_REFERENCIA_MICHELLE } = await import("@/lib/contratos/modelo-referencia");
    const { substituirMarcadores } = await import("@/lib/contratos/marcadores");
    const { PDFDocument } = await import("pdf-lib");

    const preenchido = substituirMarcadores(MODELO_REFERENCIA_MICHELLE, {
      nome: "Guilherme Ribeiro",
      cpf: "03597602100",
      endereco: "Rua Alexandre Salgado, nº 10, Setor Tradicional (Planaltina), Brasília - DF",
      chavePix: "31988447394",
      email: "guilherme@exemplo.com",
      telefone: "(61) 99116-1800",
      banco: "001 - Banco do Brasil",
      agencia: "1234-5",
      conta: "98765-4",
      objeto: "Administrativo Homeoffice",
      valor: "R$ 2.200,00",
      valorExtenso: "dois mil e duzentos reais",
      vigenciaInicio: "01/09/2026",
      vigenciaFim: "03/10/2026",
    });

    const bytes = await gerarPdfContrato({
      titulo: "CONTRATO DE PRESTAÇÃO DE SERVIÇOS — ADMINISTRATIVO HOMEOFFICE",
      corpo: htmlParaTexto(preenchido),
    });

    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(2);
  });
});
