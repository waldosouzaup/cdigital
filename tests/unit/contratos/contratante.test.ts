import { describe, it, expect } from "vitest";
import { qualificacaoContratante, MARCADORES_CONTRATANTE } from "@/lib/contratos/contratante";

/**
 * A qualificação da CONTRATANTE estava escrita dentro de
 * `modelo-referencia.ts` e do termo de distrato: nome, cargo, partido, endereço
 * e CNPJ de uma candidata específica. Qualquer organização nova — inclusive
 * outra campanha — emitia contrato com esses dados.
 *
 * Agora é dado da organização, com texto livre para quem precisa de redação
 * própria e composição para quem não precisa.
 */
describe("qualificacaoContratante", () => {
  it("usa a redação própria da organização quando existe", () => {
    const texto = qualificacaoContratante({
      nome: "Construtora Alfa Ltda",
      cnpj: "11.222.333/0001-44",
      endereco: "Rua B, 100",
      qualificacaoContratante:
        "CONTRATANTE: CONSTRUTORA ALFA LTDA, inscrita no CNPJ 11.222.333/0001-44, neste ato representada por seu sócio-administrador.",
    });
    expect(texto).toBe(
      "CONTRATANTE: CONSTRUTORA ALFA LTDA, inscrita no CNPJ 11.222.333/0001-44, neste ato representada por seu sócio-administrador.",
    );
  });

  it("compõe a partir de nome, CNPJ e endereço quando não há redação própria", () => {
    const texto = qualificacaoContratante({
      nome: "Comitê Central",
      cnpj: "11.222.333/0001-44",
      endereco: "Rua B, 100",
    });
    expect(texto).toContain("CONTRATANTE: Comitê Central");
    expect(texto).toContain("11.222.333/0001-44");
    expect(texto).toContain("Rua B, 100");
  });

  it("acrescenta o representante quando informado", () => {
    const texto = qualificacaoContratante({
      nome: "Produtora Beta",
      cnpj: "11.222.333/0001-44",
      representanteNome: "Ana Lima",
      representanteCargo: "Diretora",
    });
    expect(texto).toContain("Ana Lima");
    expect(texto).toContain("Diretora");
  });

  it("omite o que não foi informado, sem deixar pontuação solta", () => {
    const texto = qualificacaoContratante({ nome: "Comitê Só Nome" });
    expect(texto).toBe("CONTRATANTE: Comitê Só Nome.");
    expect(texto).not.toContain("CNPJ");
    expect(texto).not.toContain(",,");
    expect(texto).not.toMatch(/,\s*\./);
  });

  it("ignora redação própria em branco e volta a compor", () => {
    const texto = qualificacaoContratante({
      nome: "Comitê Central",
      qualificacaoContratante: "   ",
    });
    expect(texto).toBe("CONTRATANTE: Comitê Central.");
  });

  it("nunca devolve vazio, mesmo sem nome", () => {
    expect(qualificacaoContratante({ nome: "" })).toContain("CONTRATANTE");
  });

  it("declara os marcadores que os modelos podem usar", () => {
    const nomes = MARCADORES_CONTRATANTE.map((m) => m.marcador);
    expect(nomes).toContain("{{contratante}}");
    expect(nomes).toContain("{{contratante_nome}}");
    expect(nomes).toContain("{{contratante_cnpj}}");
    expect(nomes).toContain("{{contratante_endereco}}");
  });
});
