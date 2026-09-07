import { describe, it, expect } from "vitest";
import { amountInWords } from "@/lib/contratos/valor-extenso";

// Seção 12 do PROMPT: casos obrigatórios de valor por extenso.
// A biblioteca `extenso` segue a gramática numeral do português (o "e" antes de um
// grupo é regido por regra linguística, não por escolha nossa) — ver CONSULTAS.md
// para a divergência registrada com o texto de exemplo da Seção 12.
describe("amountInWords", () => {
  it("3.553,00 → três mil quinhentos e cinquenta e três reais", () => {
    expect(amountInWords(3553)).toBe("três mil quinhentos e cinquenta e três reais");
  });

  it("4.353,00 → quatro mil trezentos e cinquenta e três reais", () => {
    expect(amountInWords(4353)).toBe("quatro mil trezentos e cinquenta e três reais");
  });

  it("2.200,00 → dois mil e duzentos reais", () => {
    expect(amountInWords(2200)).toBe("dois mil e duzentos reais");
  });

  it("1.500,00 → mil e quinhentos reais", () => {
    expect(amountInWords(1500)).toBe("mil e quinhentos reais");
  });

  it("1.000.000,00 → um milhão de reais", () => {
    expect(amountInWords(1000000)).toBe("um milhão de reais");
  });

  it("0,01 → um centavo", () => {
    expect(amountInWords(0.01)).toBe("um centavo");
  });

  it("aceita valor numeric do Drizzle como string", () => {
    expect(amountInWords("3553.00")).toBe("três mil quinhentos e cinquenta e três reais");
  });
});
