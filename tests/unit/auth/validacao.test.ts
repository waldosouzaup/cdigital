import { describe, it, expect } from "vitest";
import { validarNovaSenha, SENHA_MIN } from "@/lib/auth/validacao";

describe("validarNovaSenha", () => {
  it("aceita senha com o mínimo de caracteres e confirmação igual", () => {
    const r = validarNovaSenha("senhaboa1", "senhaboa1");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.senha).toBe("senhaboa1");
  });

  it("recusa senha curta", () => {
    const r = validarNovaSenha("curta", "curta");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toContain(String(SENHA_MIN));
  });

  it("recusa confirmação diferente", () => {
    const r = validarNovaSenha("senhaboa1", "senhaboa2");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toMatch(/não coincidem/i);
  });

  it("trata entradas vazias/nulas sem quebrar", () => {
    expect(validarNovaSenha("", "").ok).toBe(false);
    expect(validarNovaSenha(undefined as unknown as string, undefined as unknown as string).ok).toBe(false);
  });
});
