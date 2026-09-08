import { describe, it, expect } from "vitest";
import { validarNomeRegiao } from "@/lib/regioes/validacao";

/**
 * Item 2 — cadastro de Região de Atuação. Lógica pura: as Server Actions
 * `criarRegiao`/`renomearRegiao` só gravam quando `ok`.
 */
describe("validarNomeRegiao", () => {
  it("aceita um nome novo e o normaliza (trim + espaços)", () => {
    const r = validarNomeRegiao("  Águas   Claras  ", ["Gama", "Paranoá"]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.nome).toBe("Águas Claras");
  });

  it("exige nome não vazio", () => {
    expect(validarNomeRegiao("   ", []).ok).toBe(false);
  });

  it("limita a 60 caracteres", () => {
    expect(validarNomeRegiao("x".repeat(61), []).ok).toBe(false);
  });

  it("recusa duplicata ignorando caixa e acento", () => {
    expect(validarNomeRegiao("aguas claras", ["Águas Claras"]).ok).toBe(false);
    expect(validarNomeRegiao("GAMA", ["Gama"]).ok).toBe(false);
  });

  it("permite manter o próprio nome (renomear sem trocar) via `ignorar`", () => {
    const r = validarNomeRegiao("Gama", ["Gama", "Paranoá"], "Gama");
    expect(r.ok).toBe(true);
  });
});
