import { describe, it, expect } from "vitest";
import { validarIdentidadeComite } from "@/lib/organizacao/validacao";

/**
 * Item 4 — edição da identidade do comitê (nome + CNPJ). Lógica pura: a Server
 * Action `salvarIdentidadeComite` chama isto e só grava se `ok`.
 */
describe("validarIdentidadeComite", () => {
  it("aceita nome preenchido e CNPJ válido, normalizando", () => {
    const r = validarIdentidadeComite({ nome: "  Comitê Michelle 2026  ", cnpj: "68608523000159" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.valores).toEqual({ nome: "Comitê Michelle 2026", cnpj: "68.608.523/0001-59" });
  });

  it("aceita CNPJ vazio (opcional) e devolve null", () => {
    const r = validarIdentidadeComite({ nome: "Comitê X", cnpj: "" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.valores.cnpj).toBeNull();
  });

  it("exige o nome", () => {
    const r = validarIdentidadeComite({ nome: "   ", cnpj: "" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erros.nome).toBeTruthy();
  });

  it("limita o nome a 120 caracteres", () => {
    const r = validarIdentidadeComite({ nome: "x".repeat(121), cnpj: "" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erros.nome).toBeTruthy();
  });

  it("recusa CNPJ com dígito verificador errado", () => {
    const r = validarIdentidadeComite({ nome: "Comitê X", cnpj: "68.608.523/0001-58" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erros.cnpj).toMatch(/cnpj/i);
  });
});
