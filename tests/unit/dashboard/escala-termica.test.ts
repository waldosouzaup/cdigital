import { describe, expect, it } from "vitest";
import {
  obterEscalaTermica,
  ETAPAS_FUNIL_CONFIG,
} from "@/lib/dashboard/escala-termica";

describe("obterEscalaTermica", () => {
  it("trata null e NaN como sem_dados", () => {
    const semDados = obterEscalaTermica(null);
    expect(semDados.nivel).toBe("sem_dados");
    expect(semDados.rotuloCurto).toBe("Sem dados");

    const nanResultado = obterEscalaTermica(Number.NaN);
    expect(nanResultado.nivel).toBe("sem_dados");
  });

  it("mapeia faixa fria (0% a 25%) com tons de azul/sky", () => {
    const zero = obterEscalaTermica(0);
    expect(zero.nivel).toBe("frio");
    expect(zero.icone).toBe("🧊");
    expect(zero.badgeClasse).toContain("sky");

    const vinteCinco = obterEscalaTermica(25);
    expect(vinteCinco.nivel).toBe("frio");
  });

  it("mapeia faixa morna (26% a 50%) com tons de âmbar", () => {
    const vinteSeis = obterEscalaTermica(26);
    expect(vinteSeis.nivel).toBe("morno");
    expect(vinteSeis.icone).toBe("⛅");
    expect(vinteSeis.badgeClasse).toContain("amber");

    const cinquenta = obterEscalaTermica(50);
    expect(cinquenta.nivel).toBe("morno");
  });

  it("mapeia faixa quente (51% a 75%) com tons de laranja", () => {
    const cinquentaUm = obterEscalaTermica(51);
    expect(cinquentaUm.nivel).toBe("quente");
    expect(cinquentaUm.icone).toBe("☀️");
    expect(cinquentaUm.badgeClasse).toContain("orange");

    const setentaCinco = obterEscalaTermica(75);
    expect(setentaCinco.nivel).toBe("quente");
  });

  it("mapeia faixa muito quente (76% a 100%) com tons de fogo/rose", () => {
    const setentaSeis = obterEscalaTermica(76);
    expect(setentaSeis.nivel).toBe("muito_quente");
    expect(setentaSeis.icone).toBe("🔥");
    expect(setentaSeis.badgeClasse).toContain("rose");

    const cem = obterEscalaTermica(100);
    expect(cem.nivel).toBe("muito_quente");
  });
});

describe("ETAPAS_FUNIL_CONFIG", () => {
  it("contém as 5 etapas com cores semânticas distintas", () => {
    expect(ETAPAS_FUNIL_CONFIG).toHaveLength(5);
    const chaves = ETAPAS_FUNIL_CONFIG.map((e) => e.chave);
    expect(chaves).toEqual(["cadastrados", "aptos", "emitido", "enviado", "assinado"]);

    const cores = ETAPAS_FUNIL_CONFIG.map((e) => e.corTopo);
    // Cada etapa tem cor topo distinta
    const coresUnicas = new Set(cores);
    expect(coresUnicas.size).toBe(5);
  });
});
