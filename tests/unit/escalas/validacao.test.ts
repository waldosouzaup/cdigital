import { describe, it, expect } from "vitest";
import { validarEscala } from "@/lib/escalas/validacao";

/**
 * Escala é compromisso futuro; `registros_atividade` registra o que já foi
 * feito. Sem este conceito, evento que contrata a mesma pessoa para três dias em
 * horários diferentes virava três contratos ou nenhum controle (migration 0043).
 *
 * A validação espelha as duas restrições do banco — intervalo válido e ausência
 * de sobreposição — para devolver português no formulário em vez de 23P01.
 */
const base = {
  pessoaId: "11111111-1111-1111-1111-111111111111",
  inicio: "2026-10-01T14:00",
  fim: "2026-10-01T22:00",
};

describe("validarEscala", () => {
  it("aceita um turno bem formado", () => {
    const r = validarEscala({ ...base, funcao: "  Portaria  " });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.valores.funcao).toBe("Portaria");
      expect(new Date(r.valores.fim).getTime()).toBeGreaterThan(
        new Date(r.valores.inicio).getTime(),
      );
    }
  });

  it("aceita turno que atravessa a meia-noite", () => {
    const r = validarEscala({ ...base, inicio: "2026-10-01T22:00", fim: "2026-10-02T04:00" });
    expect(r.ok).toBe(true);
  });

  it("exige a pessoa", () => {
    const r = validarEscala({ ...base, pessoaId: "" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erros.pessoaId).toBeTruthy();
  });

  it("recusa fim anterior ou igual ao início", () => {
    for (const fim of ["2026-10-01T13:00", "2026-10-01T14:00"]) {
      const r = validarEscala({ ...base, fim });
      expect(r.ok, fim).toBe(false);
      if (!r.ok) expect(r.erros.fim).toBeTruthy();
    }
  });

  it("recusa data malformada em vez de gravar algo que o banco recusaria", () => {
    expect(validarEscala({ ...base, inicio: "ontem" }).ok).toBe(false);
    expect(validarEscala({ ...base, fim: "" }).ok).toBe(false);
  });

  it("recusa turno absurdamente longo, que é quase sempre erro de digitação", () => {
    const r = validarEscala({ ...base, inicio: "2026-10-01T08:00", fim: "2026-10-05T08:00" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erros.fim).toBeTruthy();
  });

  it("normaliza campos livres vazios para nulo", () => {
    const r = validarEscala({ ...base, funcao: "   ", local: "", observacao: "  " });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.valores.funcao).toBeNull();
      expect(r.valores.local).toBeNull();
      expect(r.valores.observacao).toBeNull();
    }
  });

  it("detecta sobreposição com turnos já existentes da mesma pessoa", () => {
    const existentes = [{ inicio: "2026-10-01T12:00Z", fim: "2026-10-01T18:00Z" }];
    const r = validarEscala(
      { ...base, inicio: "2026-10-01T14:00Z", fim: "2026-10-01T22:00Z" },
      existentes,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erros.inicio).toContain("outro turno");
  });

  it("não acusa sobreposição em turnos apenas encostados", () => {
    const existentes = [{ inicio: "2026-10-01T08:00Z", fim: "2026-10-01T14:00Z" }];
    const r = validarEscala(
      { ...base, inicio: "2026-10-01T14:00Z", fim: "2026-10-01T22:00Z" },
      existentes,
    );
    expect(r.ok).toBe(true);
  });
});
