import { describe, it, expect } from "vitest";
import {
  canTransition,
  transitionOrThrow,
  ACTIVE_BOARD_STATUSES,
  type ContractStatus,
} from "@/lib/contratos/maquina-estados";

// Transições válidas — Seção 7 do PROMPT
const VALID_TRANSITIONS: [ContractStatus, ContractStatus][] = [
  ["rascunho", "emitido"],
  ["rascunho", "cancelado"],
  ["emitido", "enviado"],
  ["emitido", "cancelado"],
  ["enviado", "assinado"],
  ["enviado", "cancelado"],
  ["assinado", "distratado"],
  ["assinado", "encerrado"],
  ["distratado", "distrato_assinado"],
];

// Transições inválidas — pelo menos 5, exigido pelo gate da Fase 1
const INVALID_TRANSITIONS: [ContractStatus, ContractStatus][] = [
  ["emitido", "assinado"], // pula "enviado"
  ["rascunho", "assinado"], // pula tudo
  ["rascunho", "enviado"],
  ["encerrado", "assinado"], // estado terminal
  ["cancelado", "rascunho"], // estado terminal
  ["distrato_assinado", "encerrado"], // estado terminal
  ["assinado", "rascunho"], // regressão
  ["enviado", "emitido"], // regressão
];

describe("canTransition", () => {
  it.each(VALID_TRANSITIONS)("permite %s → %s", (from, to) => {
    expect(canTransition(from, to)).toBe(true);
  });

  it.each(INVALID_TRANSITIONS)("rejeita %s → %s", (from, to) => {
    expect(canTransition(from, to)).toBe(false);
  });

  it("rejeita transição para o mesmo estado", () => {
    expect(canTransition("emitido", "emitido")).toBe(false);
  });
});

describe("transitionOrThrow", () => {
  it("retorna o novo estado quando a transição é válida", () => {
    expect(transitionOrThrow("rascunho", "emitido")).toBe("emitido");
  });

  it("lança erro explicativo em português numa transição inválida", () => {
    expect(() => transitionOrThrow("emitido", "assinado")).toThrowError(
      /emitido.*enviado.*cancelado/i,
    );
  });

  it("o erro nomeia o estado atual e os destinos permitidos", () => {
    try {
      transitionOrThrow("assinado", "rascunho");
      expect.fail("deveria ter lançado erro");
    } catch (error) {
      expect((error as Error).message).toContain("assinado");
      expect((error as Error).message).toMatch(/distratado|encerrado/);
    }
  });
});

describe("ACTIVE_BOARD_STATUSES", () => {
  it("contém exatamente emitido, enviado e assinado", () => {
    expect(ACTIVE_BOARD_STATUSES).toEqual(
      expect.arrayContaining(["emitido", "enviado", "assinado"]),
    );
    expect(ACTIVE_BOARD_STATUSES).toHaveLength(3);
  });

  it("não inclui estados de distrato nem estados terminais fora do fluxo ativo", () => {
    expect(ACTIVE_BOARD_STATUSES).not.toContain("distratado");
    expect(ACTIVE_BOARD_STATUSES).not.toContain("distrato_assinado");
    expect(ACTIVE_BOARD_STATUSES).not.toContain("encerrado");
    expect(ACTIVE_BOARD_STATUSES).not.toContain("cancelado");
    expect(ACTIVE_BOARD_STATUSES).not.toContain("rascunho");
  });
});
