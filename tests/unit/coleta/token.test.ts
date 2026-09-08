import { describe, expect, it } from "vitest";
import { gerarTokenColeta } from "@/lib/coleta/token";

/**
 * Fase 2, item 2: token do link de coleta precisa ser impossível de adivinhar (é a
 * única "senha" de quem preenche o formulário — não há login).
 */
describe("gerarTokenColeta", () => {
  it("gera string só com caracteres seguros para URL", () => {
    const token = gerarTokenColeta();
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("gera token longo o suficiente para não ser adivinhável (>= 32 caracteres)", () => {
    const token = gerarTokenColeta();
    expect(token.length).toBeGreaterThanOrEqual(32);
  });

  it("gera tokens diferentes a cada chamada", () => {
    const tokens = new Set(Array.from({ length: 50 }, () => gerarTokenColeta()));
    expect(tokens.size).toBe(50);
  });
});
