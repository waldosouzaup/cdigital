import { describe, it, expect } from "vitest";
import { validarRegistroAtividade } from "@/lib/atividades/registro-rapido";

/**
 * Fase 4, item 1 — "registro de atividade em 3 toques". Lógica pura de validação
 * do que o formulário de campo envia, antes de gravar em `registros_atividade`.
 */
const HOJE = "2026-09-08";

const base = {
  pessoaId: "11111111-1111-1111-1111-111111111111",
  regiaoId: "22222222-2222-2222-2222-222222222222",
  tipo: "Panfletagem",
  quantidade: "500",
  observacao: "",
  data: HOJE,
};

describe("validarRegistroAtividade", () => {
  it("aceita um registro bem preenchido e normaliza os valores", () => {
    const r = validarRegistroAtividade({ ...base, observacao: "  entrada da feira  " }, HOJE);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.valores).toEqual({
        pessoaId: base.pessoaId,
        regiaoId: base.regiaoId,
        tipo: "Panfletagem",
        quantidade: 500,
        observacao: "entrada da feira",
        data: HOJE,
        // Coordenada entrou em 0038 e e opcional: registro sem GPS continua valido.
        latitude: null,
        longitude: null,
        precisaoM: null,
      });
    }
  });

  it("exige a pessoa (quem executou a atividade)", () => {
    const r = validarRegistroAtividade({ ...base, pessoaId: "" }, HOJE);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erros.pessoaId).toBeTruthy();
  });

  it("exige um tipo de atividade não vazio, com no máximo 80 caracteres", () => {
    expect(validarRegistroAtividade({ ...base, tipo: "   " }, HOJE).ok).toBe(false);
    expect(validarRegistroAtividade({ ...base, tipo: "x".repeat(81) }, HOJE).ok).toBe(false);
  });

  it("exige quantidade inteira e positiva", () => {
    for (const q of ["0", "-3", "abc", "2.5", ""]) {
      const r = validarRegistroAtividade({ ...base, quantidade: q }, HOJE);
      expect(r.ok, `quantidade=${q}`).toBe(false);
      if (!r.ok) expect(r.erros.quantidade).toBeTruthy();
    }
  });

  it("aceita quantidade como number além de string", () => {
    const r = validarRegistroAtividade({ ...base, quantidade: 12 }, HOJE);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.valores.quantidade).toBe(12);
  });

  it("recusa data no futuro (atividade de campo é sempre passada ou de hoje)", () => {
    const r = validarRegistroAtividade({ ...base, data: "2026-09-09" }, HOJE);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erros.data).toBeTruthy();
  });

  it("aceita data anterior a hoje", () => {
    expect(validarRegistroAtividade({ ...base, data: "2026-09-01" }, HOJE).ok).toBe(true);
  });

  it("trata regiaoId ausente como null (a região pode vir da pessoa depois)", () => {
    const r = validarRegistroAtividade({ ...base, regiaoId: "" }, HOJE);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.valores.regiaoId).toBeNull();
  });

  it("limita a observação a 500 caracteres", () => {
    const r = validarRegistroAtividade({ ...base, observacao: "x".repeat(501) }, HOJE);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erros.observacao).toBeTruthy();
  });
});

/**
 * Coordenada no registro de campo (migration 0038). Trade marketing precisa da
 * prova de que a visita aconteceu na loja; campanha não precisava, então o campo
 * é opcional e nunca impede a gravação — sinal ruim é o normal em campo.
 *
 * A validação aqui espelha a restrição do banco, que barra meia coordenada:
 * latitude sem longitude não localiza nada e ainda passa a impressão de que
 * localiza.
 */
describe("validarRegistroAtividade — coordenada", () => {
  const base = {
    pessoaId: "11111111-1111-1111-1111-111111111111",
    tipo: "Panfletagem",
    quantidade: "10",
    data: "2026-09-12",
  };

  it("aceita registro sem coordenada nenhuma", () => {
    const r = validarRegistroAtividade(base, "2026-09-12");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.valores.latitude).toBeNull();
      expect(r.valores.longitude).toBeNull();
    }
  });

  it("aceita e normaliza um par válido", () => {
    const r = validarRegistroAtividade(
      { ...base, latitude: "-15.7797", longitude: "-47.9297", precisaoM: "12.5" },
      "2026-09-12",
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.valores.latitude).toBeCloseTo(-15.7797);
      expect(r.valores.longitude).toBeCloseTo(-47.9297);
      expect(r.valores.precisaoM).toBeCloseTo(12.5);
    }
  });

  it("descarta meia coordenada em vez de gravar posição falsa", () => {
    for (const parcial of [
      { latitude: "-15.77" },
      { longitude: "-47.92" },
    ]) {
      const r = validarRegistroAtividade({ ...base, ...parcial }, "2026-09-12");
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.valores.latitude).toBeNull();
        expect(r.valores.longitude).toBeNull();
      }
    }
  });

  it("descarta coordenada fora de faixa", () => {
    const r = validarRegistroAtividade(
      { ...base, latitude: "200", longitude: "-47.92" },
      "2026-09-12",
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.valores.latitude).toBeNull();
  });

  it("descarta valor não numérico sem derrubar o registro", () => {
    const r = validarRegistroAtividade(
      { ...base, latitude: "abc", longitude: "def" },
      "2026-09-12",
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.valores.longitude).toBeNull();
  });

  it("ignora precisão inválida mas mantém a coordenada", () => {
    const r = validarRegistroAtividade(
      { ...base, latitude: "-15.77", longitude: "-47.92", precisaoM: "-3" },
      "2026-09-12",
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.valores.latitude).toBeCloseTo(-15.77);
      expect(r.valores.precisaoM).toBeNull();
    }
  });
});
