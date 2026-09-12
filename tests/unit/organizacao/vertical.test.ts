import { describe, it, expect } from "vitest";
import {
  VERTICAIS,
  ehVertical,
  termos,
  type Vertical,
} from "@/lib/organizacao/vertical";

/**
 * O motor do sistema não sabe que existe eleição — nenhuma tabela, coluna ou
 * enum nomeia campanha. O que prendia o produto ao domínio eleitoral era
 * vocabulário de interface, e é só isso que este dicionário troca.
 *
 * Nada aqui muda schema, regra ou permissão: é tradução de rótulo.
 */
describe("dicionário de vertical", () => {
  it("traz as quatro verticais previstas", () => {
    expect(VERTICAIS.map((v) => v.id)).toEqual(["campanha", "evento", "obra", "varejo"]);
  });

  it("mantém o vocabulário eleitoral como padrão", () => {
    const t = termos("campanha");
    expect(t.organizacao).toBe("comitê");
    expect(t.projeto).toBe("campanha");
    expect(t.regiao).toBe("região");
  });

  it("traduz para cada vertical sem repetir o vocabulário de origem", () => {
    for (const id of ["evento", "obra", "varejo"] as Vertical[]) {
      const t = termos(id);
      expect(t.projeto).not.toBe("campanha");
      expect(t.organizacao).not.toBe("comitê");
    }
  });

  it("dá a cada vertical um termo de região que faz sentido no setor", () => {
    expect(termos("obra").regiao).toBe("frente de obra");
    expect(termos("varejo").regiao).toBe("praça");
    expect(termos("evento").regiao).toBe("setor");
  });

  it("preenche todas as chaves em todas as verticais", () => {
    const chaves = Object.keys(termos("campanha"));
    for (const { id } of VERTICAIS) {
      const t = termos(id) as unknown as Record<string, string>;
      for (const chave of chaves) {
        expect(t[chave], `${id}.${chave}`).toBeTruthy();
      }
    }
  });

  it("cai para campanha diante de valor desconhecido, em vez de quebrar a tela", () => {
    expect(termos("nao-existe")).toEqual(termos("campanha"));
    expect(termos(null)).toEqual(termos("campanha"));
    expect(termos(undefined)).toEqual(termos("campanha"));
  });

  it("ehVertical reconhece só os valores que o banco aceita", () => {
    expect(ehVertical("obra")).toBe(true);
    expect(ehVertical("campanha")).toBe(true);
    expect(ehVertical("qualquer")).toBe(false);
    expect(ehVertical(7)).toBe(false);
  });

  it("expõe rótulo e descrição para a tela de configuração", () => {
    for (const v of VERTICAIS) {
      expect(v.rotulo.length).toBeGreaterThan(2);
      expect(v.descricao.length).toBeGreaterThan(10);
    }
  });
});
