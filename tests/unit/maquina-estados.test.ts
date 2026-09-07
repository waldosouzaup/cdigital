import { describe, it, expect } from "vitest";
import {
  podeTransicionar,
  transicionarOuErro,
  CONTAM_NO_QUADRO_ATIVO,
  type StatusContrato,
} from "@/lib/contratos/maquina-estados";

// Transições válidas — Seção 7 do PROMPT
const TRANSICOES_VALIDAS: [StatusContrato, StatusContrato][] = [
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
const TRANSICOES_INVALIDAS: [StatusContrato, StatusContrato][] = [
  ["emitido", "assinado"], // pula "enviado"
  ["rascunho", "assinado"], // pula tudo
  ["rascunho", "enviado"],
  ["encerrado", "assinado"], // estado terminal
  ["cancelado", "rascunho"], // estado terminal
  ["distrato_assinado", "encerrado"], // estado terminal
  ["assinado", "rascunho"], // regressão
  ["enviado", "emitido"], // regressão
];

describe("podeTransicionar", () => {
  it.each(TRANSICOES_VALIDAS)("permite %s → %s", (de, para) => {
    expect(podeTransicionar(de, para)).toBe(true);
  });

  it.each(TRANSICOES_INVALIDAS)("rejeita %s → %s", (de, para) => {
    expect(podeTransicionar(de, para)).toBe(false);
  });

  it("rejeita transição para o mesmo estado", () => {
    expect(podeTransicionar("emitido", "emitido")).toBe(false);
  });
});

describe("transicionarOuErro", () => {
  it("retorna o novo estado quando a transição é válida", () => {
    expect(transicionarOuErro("rascunho", "emitido")).toBe("emitido");
  });

  it("lança erro explicativo em português numa transição inválida", () => {
    expect(() => transicionarOuErro("emitido", "assinado")).toThrowError(
      /emitido.*enviado.*cancelado/is,
    );
  });

  it("o erro nomeia o estado atual e os destinos permitidos", () => {
    try {
      transicionarOuErro("assinado", "rascunho");
      expect.fail("deveria ter lançado erro");
    } catch (erro) {
      expect((erro as Error).message).toContain("assinado");
      expect((erro as Error).message).toMatch(/distratado|encerrado/);
    }
  });
});

describe("CONTAM_NO_QUADRO_ATIVO", () => {
  it("contém exatamente emitido, enviado e assinado", () => {
    expect(CONTAM_NO_QUADRO_ATIVO).toEqual(
      expect.arrayContaining(["emitido", "enviado", "assinado"]),
    );
    expect(CONTAM_NO_QUADRO_ATIVO).toHaveLength(3);
  });

  it("não inclui estados de distrato nem estados terminais fora do fluxo ativo", () => {
    expect(CONTAM_NO_QUADRO_ATIVO).not.toContain("distratado");
    expect(CONTAM_NO_QUADRO_ATIVO).not.toContain("distrato_assinado");
    expect(CONTAM_NO_QUADRO_ATIVO).not.toContain("encerrado");
    expect(CONTAM_NO_QUADRO_ATIVO).not.toContain("cancelado");
    expect(CONTAM_NO_QUADRO_ATIVO).not.toContain("rascunho");
  });
});
