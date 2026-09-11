import { describe, expect, it } from "vitest";
import { validarEdicaoPessoa } from "@/lib/pessoas/validacao";

describe("validarEdicaoPessoa", () => {
  const baseValida = {
    id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    fullName: "Carlos Eduardo Silva",
    cpf: "529.982.247-25", // válido
    rg: "1234567 SSP/DF",
    birthDate: "1990-05-15",
    phone: "(61) 99888-7766",
    email: "carlos.silva@exemplo.com",
    regionId: "e47e8b79-9950-4297-afd8-f691a4dbe775",
    role: "Administrativo e Montagem de Material",
    zipCode: "70000-000",
    address: "Quadra 10, Bloco B, Asa Norte, Brasília - DF",
    pixKey: "52998224725",
    eligible: true,
  };

  it("aceita entrada de edição completa com dados válidos", () => {
    const resultado = validarEdicaoPessoa(baseValida);
    expect(resultado.success).toBe(true);
    if (resultado.success) {
      expect(resultado.data.id).toBe(baseValida.id);
      expect(resultado.data.cpf).toBe("52998224725");
      expect(resultado.data.fullName).toBe("Carlos Eduardo Silva");
      expect(resultado.data.rg).toBe("1234567 SSP/DF");
      expect(resultado.data.birthDate).toBe("1990-05-15");
      expect(resultado.data.email).toBe("carlos.silva@exemplo.com");
      expect(resultado.data.eligible).toBe(true);
    }
  });

  it("rejeita quando id está ausente ou vazio", () => {
    const resultado = validarEdicaoPessoa({ ...baseValida, id: "" });
    expect(resultado.success).toBe(false);
    if (!resultado.success) {
      expect(resultado.errors.id).toBeDefined();
    }
  });

  it("rejeita e-mail com formato inválido", () => {
    const resultado = validarEdicaoPessoa({ ...baseValida, email: "email-invalido-sem-arroba" });
    expect(resultado.success).toBe(false);
    if (!resultado.success) {
      expect(resultado.errors.email).toBeDefined();
    }
  });

  it("aceita e-mail vazio (campo opcional)", () => {
    const resultado = validarEdicaoPessoa({ ...baseValida, email: "" });
    expect(resultado.success).toBe(true);
  });

  it("rejeita data de nascimento em formato fora de AAAA-MM-DD", () => {
    const resultado = validarEdicaoPessoa({ ...baseValida, birthDate: "15/05/1990" });
    expect(resultado.success).toBe(false);
    if (!resultado.success) {
      expect(resultado.errors.birthDate).toBeDefined();
    }
  });

  it("rejeita CPF inválido no formulário de edição", () => {
    const resultado = validarEdicaoPessoa({ ...baseValida, cpf: "000.111.222-33" });
    expect(resultado.success).toBe(false);
    if (!resultado.success) {
      expect(resultado.errors.cpf).toBeDefined();
    }
  });

  it("rejeita quando região não foi informada", () => {
    const resultado = validarEdicaoPessoa({ ...baseValida, regionId: "" });
    expect(resultado.success).toBe(false);
    if (!resultado.success) {
      expect(resultado.errors.regionId).toBeDefined();
    }
  });
});
