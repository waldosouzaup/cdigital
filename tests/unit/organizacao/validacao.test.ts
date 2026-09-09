import { describe, it, expect } from "vitest";
import { slugify, validarIdentidadeComite, validarSlug } from "@/lib/organizacao/validacao";

/**
 * Item 4 — edição da identidade do comitê (nome + CNPJ + slug público). Lógica
 * pura: a Server Action `salvarIdentidadeComite` chama isto e só grava se `ok`.
 */
describe("validarIdentidadeComite", () => {
  it("aceita nome preenchido e CNPJ válido, normalizando", () => {
    const r = validarIdentidadeComite({ nome: "  Comitê Michelle 2026  ", cnpj: "68608523000159" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.valores).toEqual({
        nome: "Comitê Michelle 2026",
        cnpj: "68.608.523/0001-59",
        slug: null,
      });
    }
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

  it("aceita slug válido e o normaliza para minúsculas", () => {
    const r = validarIdentidadeComite({ nome: "Comitê X", cnpj: "", slug: " Comite-Michelle " });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.valores.slug).toBe("comite-michelle");
  });

  it("slug vazio é permitido e limpa (null)", () => {
    const r = validarIdentidadeComite({ nome: "Comitê X", cnpj: "", slug: "" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.valores.slug).toBeNull();
  });

  it("recusa slug curto, com caractere inválido ou hífen duplo", () => {
    expect(validarIdentidadeComite({ nome: "C", cnpj: "", slug: "ab" }).ok).toBe(false);
    expect(validarIdentidadeComite({ nome: "C", cnpj: "", slug: "comitê michelle" }).ok).toBe(false);
    expect(validarIdentidadeComite({ nome: "C", cnpj: "", slug: "comite--michelle" }).ok).toBe(false);
    expect(validarIdentidadeComite({ nome: "C", cnpj: "", slug: "-comite" }).ok).toBe(false);
  });
});

describe("slugify / validarSlug", () => {
  it("slugify transforma texto livre em slug", () => {
    expect(slugify("Comitê Michelle — Eleição 2026")).toBe("comite-michelle-eleicao-2026");
  });

  it("validarSlug devolve null para vazio e para slug bom", () => {
    expect(validarSlug("")).toBeNull();
    expect(validarSlug("comite-2026")).toBeNull();
  });

  it("validarSlug aponta o problema de um slug ruim", () => {
    expect(validarSlug("x")).toBeTruthy();
    expect(validarSlug("Com Espaço")).toBeTruthy();
  });
});
