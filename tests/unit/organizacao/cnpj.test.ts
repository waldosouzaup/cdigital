import { describe, it, expect } from "vitest";
import { isValidCnpj, stripCnpj, formatCnpj } from "@/lib/organizacao/cnpj";

/**
 * Validação de CNPJ por dígito verificador — para a edição da identidade do
 * comitê (item 4). Mesmo espírito de `documentos/cpf.ts`.
 */
describe("stripCnpj", () => {
  it("remove tudo que não é dígito", () => {
    expect(stripCnpj("68.608.523/0001-59")).toBe("68608523000159");
  });
});

describe("formatCnpj", () => {
  it("aplica a máscara xx.xxx.xxx/xxxx-xx", () => {
    expect(formatCnpj("68608523000159")).toBe("68.608.523/0001-59");
  });
  it("devolve o valor cru se não tiver 14 dígitos", () => {
    expect(formatCnpj("123")).toBe("123");
  });
});

describe("isValidCnpj", () => {
  it("aceita um CNPJ real, com e sem máscara", () => {
    expect(isValidCnpj("68.608.523/0001-59")).toBe(true);
    expect(isValidCnpj("68608523000159")).toBe(true);
  });

  it("aceita outro CNPJ válido conhecido", () => {
    expect(isValidCnpj("11.222.333/0001-81")).toBe(true);
  });

  it("recusa dígito verificador errado", () => {
    expect(isValidCnpj("68.608.523/0001-58")).toBe(false);
    expect(isValidCnpj("11.222.333/0001-82")).toBe(false);
  });

  it("recusa comprimento diferente de 14", () => {
    expect(isValidCnpj("123")).toBe(false);
    expect(isValidCnpj("686085230001590")).toBe(false);
  });

  it("recusa todos os dígitos iguais", () => {
    expect(isValidCnpj("00000000000000")).toBe(false);
    expect(isValidCnpj("11111111111111")).toBe(false);
  });
});
