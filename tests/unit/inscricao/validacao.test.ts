import { describe, it, expect } from "vitest";
import { validarEntradaInscricao } from "@/lib/inscricao/validacao";

/**
 * Feature B — autoinscrição pública. Lógica pura: a Server Action de
 * `/inscricao/[slug]` só chama a RPC quando `success`.
 */
const OPCOES = {
  regioesIds: ["reg-1", "reg-2"],
  funcoes: ["Militância e Mobilização de Rua", "Administrativo Homeoffice"],
};

function base(over: Record<string, unknown> = {}) {
  return {
    nomeCompleto: "João da Silva",
    cpf: "529.982.247-25",
    telefone: "61999990000",
    email: "joao@exemplo.invalid",
    regiaoId: "reg-1",
    funcao: "Militância e Mobilização de Rua",
    consentimento: true,
    ...over,
  };
}

describe("validarEntradaInscricao", () => {
  it("aceita uma inscrição completa e normaliza cpf/e-mail", () => {
    const r = validarEntradaInscricao(base({ email: "JOAO@Exemplo.Invalid" }), OPCOES);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.cpf).toBe("52998224725");
      expect(r.data.email).toBe("joao@exemplo.invalid");
    }
  });

  it("recusa CPF com dígito verificador inválido", () => {
    const r = validarEntradaInscricao(base({ cpf: "111.111.111-11" }), OPCOES);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.errors.cpf).toBeTruthy();
  });

  it("exige consentimento marcado", () => {
    const r = validarEntradaInscricao(base({ consentimento: false }), OPCOES);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.errors.consentimento).toBeTruthy();
  });

  it("recusa função fora da lista da inscrição", () => {
    const r = validarEntradaInscricao(base({ funcao: "Diretor Nacional" }), OPCOES);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.errors.funcao).toBeTruthy();
  });

  it("recusa região fora da lista da inscrição", () => {
    const r = validarEntradaInscricao(base({ regiaoId: "reg-de-outra-campanha" }), OPCOES);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.errors.regiaoId).toBeTruthy();
  });

  it("exige e-mail", () => {
    const r = validarEntradaInscricao(base({ email: "" }), OPCOES);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.errors.email).toBeTruthy();
  });

  it("exige telefone", () => {
    const r = validarEntradaInscricao(base({ telefone: "" }), OPCOES);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.errors.telefone).toBeTruthy();
  });
});
