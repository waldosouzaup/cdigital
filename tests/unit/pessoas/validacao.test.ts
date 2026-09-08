import { describe, expect, it } from "vitest";
import { validarEntradaPessoa } from "@/lib/pessoas/validacao";

/**
 * Fase 2, item 1: "CRUD de pessoas com validação de CPF por dígito verificador."
 * Testa só a validação de entrada (pura) — a checagem de duplicata contra o banco
 * é responsabilidade da Server Action e é coberta por teste de integração.
 */
describe("validarEntradaPessoa", () => {
  const base = {
    fullName: "Ana Clara Fagundes",
    cpf: "529.982.247-25", // válido (usado nos testes de cpf.ts)
    phone: "(61) 98111-2233",
    regionId: "e47e8b79-9950-4297-afd8-f691a4dbe775",
    role: "Militância e Mobilização de Rua",
  };

  it("aceita entrada válida e normaliza o CPF (só dígitos)", () => {
    const resultado = validarEntradaPessoa(base);
    expect(resultado.success).toBe(true);
    if (resultado.success) {
      expect(resultado.data.cpf).toBe("52998224725");
      expect(resultado.data.fullName).toBe("Ana Clara Fagundes");
    }
  });

  it("rejeita CPF com dígito verificador inválido", () => {
    const resultado = validarEntradaPessoa({ ...base, cpf: "111.111.111-11" });
    expect(resultado.success).toBe(false);
    if (!resultado.success) {
      expect(resultado.errors.cpf).toBeDefined();
    }
  });

  it("rejeita nome vazio", () => {
    const resultado = validarEntradaPessoa({ ...base, fullName: "" });
    expect(resultado.success).toBe(false);
    if (!resultado.success) {
      expect(resultado.errors.fullName).toBeDefined();
    }
  });

  it("rejeita quando região não foi selecionada", () => {
    const resultado = validarEntradaPessoa({ ...base, regionId: "" });
    expect(resultado.success).toBe(false);
    if (!resultado.success) {
      expect(resultado.errors.regionId).toBeDefined();
    }
  });

  it("aceita telefone e função em branco (não são obrigatórios na Seção 5)", () => {
    const resultado = validarEntradaPessoa({ ...base, phone: "", role: "" });
    expect(resultado.success).toBe(true);
  });
});
