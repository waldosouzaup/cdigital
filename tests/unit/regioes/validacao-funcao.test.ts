import { describe, it, expect } from "vitest";
import { validarFuncaoPretendida } from "@/lib/regioes/validacao-funcao";

describe("validarFuncaoPretendida", () => {
  it("aceita nome e descrição válidos normalizando espaços", () => {
    const res = validarFuncaoPretendida(
      "  Coordenador   de Campo  ",
      "  Responsável por liderar a equipe  ",
      ["Militância"],
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.nome).toBe("Coordenador de Campo");
      expect(res.descricao).toBe("Responsável por liderar a equipe");
    }
  });

  it("aceita função sem descrição (transforma em null)", () => {
    const res = validarFuncaoPretendida("Fiscal de Votação", "", []);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.descricao).toBeNull();
    }
  });

  it("recusa nome vazio", () => {
    const res = validarFuncaoPretendida("   ", "Desc", []);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.erro).toContain("Informe o nome da função pretendida.");
    }
  });

  it("recusa nome com mais de 80 caracteres", () => {
    const res = validarFuncaoPretendida("A".repeat(81), "Desc", []);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.erro).toContain("máximo 80 caracteres");
    }
  });

  it("recusa descrição com mais de 255 caracteres", () => {
    const res = validarFuncaoPretendida("Função Válida", "D".repeat(256), []);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.erro).toContain("máximo 255 caracteres");
    }
  });

  it("recusa duplicata ignorando acentuação e maiúsculas/minúsculas", () => {
    const res = validarFuncaoPretendida("militancia e mobilizacao de rua", null, [
      "Militância e Mobilização de Rua",
    ]);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.erro).toContain("Já existe uma função pretendida com esse nome.");
    }
  });

  it("permite manter o mesmo nome quando ignorar for passado", () => {
    const res = validarFuncaoPretendida(
      "Coordenador",
      "Nova descrição",
      ["Coordenador", "Apoio"],
      "Coordenador",
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.nome).toBe("Coordenador");
      expect(res.descricao).toBe("Nova descrição");
    }
  });
});
