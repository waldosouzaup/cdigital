import { describe, it, expect } from "vitest";
import { cpfValido, limparCpf } from "@/lib/documentos/cpf";

describe("cpfValido", () => {
  it("aceita CPFs válidos sem máscara", () => {
    expect(cpfValido("11144477735")).toBe(true);
    expect(cpfValido("52998224725")).toBe(true);
  });

  it("aceita CPFs válidos com máscara", () => {
    expect(cpfValido("111.444.777-35")).toBe(true);
    expect(cpfValido("529.982.247-25")).toBe(true);
  });

  it("rejeita CPF com dígito verificador errado", () => {
    expect(cpfValido("111.444.777-36")).toBe(false);
    expect(cpfValido("52998224726")).toBe(false);
  });

  it("rejeita todos os dígitos iguais, mesmo que a matemática do DV bata", () => {
    expect(cpfValido("00000000000")).toBe(false);
    expect(cpfValido("111.111.111-11")).toBe(false);
    expect(cpfValido("99999999999")).toBe(false);
  });

  it("rejeita comprimento incorreto", () => {
    expect(cpfValido("123")).toBe(false);
    expect(cpfValido("123456789012")).toBe(false);
    expect(cpfValido("")).toBe(false);
  });

  it("rejeita entrada não numérica além da máscara", () => {
    expect(cpfValido("abc.def.ghi-jk")).toBe(false);
  });
});

describe("limparCpf", () => {
  it("remove pontuação e mantém só dígitos", () => {
    expect(limparCpf("111.444.777-35")).toBe("11144477735");
    expect(limparCpf("11144477735")).toBe("11144477735");
  });
});
