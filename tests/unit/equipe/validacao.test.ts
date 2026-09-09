import { describe, it, expect } from "vitest";
import { validarEntradaUsuario } from "@/lib/equipe/validacao";

/**
 * Feature A — Gestão de Acessos. Lógica pura: o Route Handler `/api/equipe/convite`
 * e as Server Actions de `/equipe` só gravam quando `ok`. A região só é exigida
 * para `coord_regiao` (espelha o CHECK `usuarios_regiao_obrigatoria_coord`, 0016).
 */
const PAPEIS = ["gestor", "coord_comite", "coord_regiao", "contratado", "auditor"] as const;
const REGIOES = ["reg-1", "reg-2"];

function base(over: Partial<Parameters<typeof validarEntradaUsuario>[0]> = {}) {
  return { nome: "Ana Souza", email: "ana@exemplo.invalid", papel: "coord_comite", regiaoId: "", ...over };
}

describe("validarEntradaUsuario", () => {
  it("aceita um membro sem região quando o papel não é coord_regiao", () => {
    const r = validarEntradaUsuario(base({ papel: "auditor" }), { papeisValidos: PAPEIS, regioesIds: REGIOES });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.valores.regiaoId).toBeNull();
  });

  it("normaliza nome (trim + espaços) e e-mail (trim + minúsculas)", () => {
    const r = validarEntradaUsuario(
      base({ nome: "  Ana   Souza ", email: "  ANA@Exemplo.Invalid " }),
      { papeisValidos: PAPEIS, regioesIds: REGIOES },
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.valores.nome).toBe("Ana Souza");
      expect(r.valores.email).toBe("ana@exemplo.invalid");
    }
  });

  it("exige região para coord_regiao", () => {
    const r = validarEntradaUsuario(
      base({ papel: "coord_regiao", regiaoId: "" }),
      { papeisValidos: PAPEIS, regioesIds: REGIOES },
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erros.regiaoId).toBeTruthy();
  });

  it("recusa região que não pertence à organização", () => {
    const r = validarEntradaUsuario(
      base({ papel: "coord_regiao", regiaoId: "reg-de-outra-org" }),
      { papeisValidos: PAPEIS, regioesIds: REGIOES },
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erros.regiaoId).toBeTruthy();
  });

  it("aceita coord_regiao com região válida e mantém o id", () => {
    const r = validarEntradaUsuario(
      base({ papel: "coord_regiao", regiaoId: "reg-2" }),
      { papeisValidos: PAPEIS, regioesIds: REGIOES },
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.valores.regiaoId).toBe("reg-2");
  });

  it("ignora a região informada para papéis que não são coord_regiao", () => {
    const r = validarEntradaUsuario(
      base({ papel: "gestor", regiaoId: "reg-1" }),
      { papeisValidos: PAPEIS, regioesIds: REGIOES },
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.valores.regiaoId).toBeNull();
  });

  it("recusa e-mail sem forma válida", () => {
    const r = validarEntradaUsuario(base({ email: "ana(at)exemplo" }), {
      papeisValidos: PAPEIS,
      regioesIds: REGIOES,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erros.email).toBeTruthy();
  });

  it("recusa papel fora do enum", () => {
    const r = validarEntradaUsuario(base({ papel: "supervisor" }), {
      papeisValidos: PAPEIS,
      regioesIds: REGIOES,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erros.papel).toBeTruthy();
  });

  it("exige nome não vazio", () => {
    const r = validarEntradaUsuario(base({ nome: "   " }), { papeisValidos: PAPEIS, regioesIds: REGIOES });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erros.nome).toBeTruthy();
  });
});
