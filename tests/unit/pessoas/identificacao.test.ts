import { describe, it, expect } from "vitest";
import { validarIdentificacao } from "@/lib/pessoas/identificacao";

/**
 * `pessoas.cpf` era NOT NULL, então não cabia subcontratado PJ — o que barrava
 * construção civil por inteiro (migration 0042).
 *
 * Esta validação espelha a restrição `pessoas_identificacao_coerente` do banco:
 * física exige CPF e recusa CNPJ; jurídica exige CNPJ e recusa CPF. Espelhar em
 * vez de confiar só no banco é o que permite devolver mensagem em português no
 * formulário, em vez de um erro 23514.
 */
describe("validarIdentificacao", () => {
  it("aceita pessoa física com CPF válido e normaliza para dígitos", () => {
    const r = validarIdentificacao({ tipoPessoa: "fisica", cpf: "123.456.789-09" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.valores).toEqual({ tipoPessoa: "fisica", cpf: "12345678909", cnpj: null });
    }
  });

  it("aceita pessoa jurídica com CNPJ válido e zera o CPF", () => {
    const r = validarIdentificacao({ tipoPessoa: "juridica", cnpj: "11.222.333/0001-81" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.valores.cpf).toBeNull();
      expect(r.valores.cnpj).toBe("11222333000181");
    }
  });

  it("recusa física sem CPF", () => {
    const r = validarIdentificacao({ tipoPessoa: "fisica", cpf: "" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erros.cpf).toBeTruthy();
  });

  it("recusa jurídica sem CNPJ", () => {
    const r = validarIdentificacao({ tipoPessoa: "juridica", cnpj: "" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erros.cnpj).toBeTruthy();
  });

  it("recusa dígito verificador inválido nos dois tipos", () => {
    expect(validarIdentificacao({ tipoPessoa: "fisica", cpf: "111.111.111-11" }).ok).toBe(false);
    expect(validarIdentificacao({ tipoPessoa: "juridica", cnpj: "11.222.333/0001-00" }).ok).toBe(
      false,
    );
  });

  it("descarta o documento do outro tipo em vez de gravar os dois", () => {
    // O CHECK do banco recusaria a linha; aqui o excedente é simplesmente ignorado.
    const r = validarIdentificacao({
      tipoPessoa: "juridica",
      cpf: "123.456.789-09",
      cnpj: "11.222.333/0001-81",
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.valores.cpf).toBeNull();
  });

  it("trata tipo ausente como física, que é o caso das 585 linhas existentes", () => {
    const r = validarIdentificacao({ cpf: "123.456.789-09" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.valores.tipoPessoa).toBe("fisica");
  });

  it("recusa tipo desconhecido em vez de adivinhar", () => {
    const r = validarIdentificacao({ tipoPessoa: "mista", cpf: "123.456.789-09" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erros.tipoPessoa).toBeTruthy();
  });
});
