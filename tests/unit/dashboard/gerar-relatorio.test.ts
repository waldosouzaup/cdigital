import { describe, expect, it } from "vitest";
import { gerarPdfRelatorio } from "@/lib/dashboard/gerar-relatorio";

/**
 * Fase 3, item 7: "Exportação em PDF (layout institucional)."
 */
describe("gerarPdfRelatorio", () => {
  it("produz um PDF de verdade com os números do relatório", async () => {
    const bytes = await gerarPdfRelatorio({
      organizacaoNome: "Comitê Michelle — Eleição 2026",
      geradoEm: new Date("2026-09-08T12:00:00Z"),
      funil: { cadastrado: 100, apto: 90, emitido: 80, enviado: 70, assinado: 50 },
      matriz: {
        linhas: [
          {
            objeto: "Militância",
            porStatus: { emitido: 5, enviado: 3, assinado: 2 },
            total: 10,
            valorTotal: 15000,
          },
        ],
        totalGeral: 10,
        totalPorStatus: { emitido: 5, enviado: 3, assinado: 2 },
        valorTotalGeral: 15000,
      },
      regioes: [
        { nome: "Águas Claras", totalPessoas: 20, pessoasAptas: 18, contratosAssinados: 10, coberturaDocumentalPct: 90 },
      ],
    });

    const assinatura = Buffer.from(bytes.slice(0, 5)).toString("ascii");
    expect(assinatura).toBe("%PDF-");
    expect(bytes.length).toBeGreaterThan(500);
  });
});
