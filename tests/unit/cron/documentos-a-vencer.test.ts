import { describe, it, expect } from "vitest";
import { documentosAVencer, PRAZOS_DOCUMENTO_DIAS } from "@/lib/cron/selecao";

/**
 * Documento com prazo (NR, ASO, treinamento, credencial) vencia em silêncio:
 * ficava marcado como aprovado para sempre e a conferência não tinha como saber.
 *
 * Espelha `contratosAVencer` de propósito — mesmo formato de aviso, mesmo job
 * diário, para não criar uma segunda mecânica de alerta no sistema.
 */
const base = { id: "d1", status: "aprovado", validoAte: "2026-09-19" };

describe("documentosAVencer", () => {
  it("avisa exatamente nos prazos previstos", () => {
    for (const prazo of PRAZOS_DOCUMENTO_DIAS) {
      const validoAte = new Date(Date.UTC(2026, 8, 12) + prazo * 86400000)
        .toISOString()
        .slice(0, 10);
      const r = documentosAVencer([{ ...base, validoAte }], "2026-09-12", PRAZOS_DOCUMENTO_DIAS);
      expect(r, `prazo ${prazo}`).toEqual([{ documentoId: "d1", prazo }]);
    }
  });

  it("não avisa fora dos prazos — um aviso por dia previsto, não todo dia", () => {
    // 2026-09-12 + 10 dias não é nenhum dos prazos.
    const r = documentosAVencer([{ ...base, validoAte: "2026-09-22" }], "2026-09-12", [7, 3]);
    expect(r).toEqual([]);
  });

  it("ignora documento que não está aprovado", () => {
    for (const status of ["pendente", "rejeitado"]) {
      const r = documentosAVencer(
        [{ ...base, status, validoAte: "2026-09-19" }],
        "2026-09-12",
        [7],
      );
      expect(r, status).toEqual([]);
    }
  });

  it("ignora documento sem data de validade", () => {
    const r = documentosAVencer([{ ...base, validoAte: null }], "2026-09-12", [7]);
    expect(r).toEqual([]);
  });

  it("ignora documento já vencido — o aviso é preventivo, não um lamento", () => {
    const r = documentosAVencer([{ ...base, validoAte: "2026-09-01" }], "2026-09-12", [7, 3]);
    expect(r).toEqual([]);
  });

  it("avisa cada documento separadamente", () => {
    const r = documentosAVencer(
      [
        { id: "a", status: "aprovado", validoAte: "2026-09-19" },
        { id: "b", status: "aprovado", validoAte: "2026-09-15" },
      ],
      "2026-09-12",
      [7, 3],
    );
    expect(r).toEqual([
      { documentoId: "a", prazo: 7 },
      { documentoId: "b", prazo: 3 },
    ]);
  });
});
