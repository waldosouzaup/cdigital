import { describe, it, expect } from "vitest";
import { isValidCpf, stripCpf } from "@/lib/documentos/cpf";

describe("isValidCpf", () => {
  it("aceita CPFs válidos sem máscara", () => {
    expect(isValidCpf("11144477735")).toBe(true);
    expect(isValidCpf("52998224725")).toBe(true);
  });

  it("aceita CPFs válidos com máscara", () => {
    expect(isValidCpf("111.444.777-35")).toBe(true);
    expect(isValidCpf("529.982.247-25")).toBe(true);
  });

  it("rejeita CPF com dígito verificador errado", () => {
    expect(isValidCpf("111.444.777-36")).toBe(false);
    expect(isValidCpf("52998224726")).toBe(false);
  });

  it("rejeita todos os dígitos iguais, mesmo que a matemática do DV bata", () => {
    expect(isValidCpf("00000000000")).toBe(false);
    expect(isValidCpf("111.111.111-11")).toBe(false);
    expect(isValidCpf("99999999999")).toBe(false);
  });

  it("rejeita comprimento incorreto", () => {
    expect(isValidCpf("123")).toBe(false);
    expect(isValidCpf("123456789012")).toBe(false);
    expect(isValidCpf("")).toBe(false);
  });

  it("rejeita entrada não numérica além da máscara", () => {
    expect(isValidCpf("abc.def.ghi-jk")).toBe(false);
  });
});

describe("stripCpf", () => {
  it("remove pontuação e mantém só dígitos", () => {
    expect(stripCpf("111.444.777-35")).toBe("11144477735");
    expect(stripCpf("11144477735")).toBe("11144477735");
  });
});
