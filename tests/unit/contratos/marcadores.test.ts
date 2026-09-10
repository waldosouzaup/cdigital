import { describe, expect, it } from "vitest";
import { substituirMarcadores } from "@/lib/contratos/marcadores";

/**
 * Fase 2, item 7: marcadores {{nome}}, {{cpf}}, {{endereco}}, {{chave_pix}},
 * {{objeto}}, {{valor}}, {{valor_extenso}}, {{vigencia_inicio}}, {{vigencia_fim}}.
 */
const dados = {
  nome: "Ana Clara Fagundes",
  cpf: "529.982.247-25",
  endereco: "Rua das Flores, 123",
  chavePix: "ana.fagundes@exemplo.invalid",
  objeto: "Militância e Mobilização de Rua",
  valor: "R$ 1.500,00",
  valorExtenso: "um mil e quinhentos reais",
  vigenciaInicio: "01/09/2026",
  vigenciaFim: "03/10/2026",
};

describe("substituirMarcadores", () => {
  it("substitui todos os marcadores suportados", () => {
    const corpo =
      "{{nome}}, CPF {{cpf}}, residente em {{endereco}}, chave PIX {{chave_pix}}. Objeto: {{objeto}}. " +
      "Valor: {{valor}} ({{valor_extenso}}). Vigência: {{vigencia_inicio}} a {{vigencia_fim}}.";

    const resultado = substituirMarcadores(corpo, dados);

    expect(resultado).toBe(
      "Ana Clara Fagundes, CPF 529.982.247-25, residente em Rua das Flores, 123, " +
        "chave PIX ana.fagundes@exemplo.invalid. Objeto: Militância e Mobilização de Rua. " +
        "Valor: R$ 1.500,00 (um mil e quinhentos reais). Vigência: 01/09/2026 a 03/10/2026.",
    );
  });

  it("substitui um marcador repetido mais de uma vez no mesmo corpo", () => {
    const resultado = substituirMarcadores("{{nome}} declara que {{nome}} está ciente.", dados);
    expect(resultado).toBe("Ana Clara Fagundes declara que Ana Clara Fagundes está ciente.");
  });

  it("não altera texto sem nenhum marcador", () => {
    expect(substituirMarcadores("Texto fixo sem variáveis.", dados)).toBe(
      "Texto fixo sem variáveis.",
    );
  });

  it("nunca deixa um marcador sem substituir quando todos os dados estão presentes", () => {
    const corpo =
      "{{nome}} {{cpf}} {{endereco}} {{chave_pix}} {{objeto}} {{valor}} {{valor_extenso}} {{vigencia_inicio}} {{vigencia_fim}}";
    const resultado = substituirMarcadores(corpo, dados);
    expect(resultado).not.toMatch(/\{\{.*\}\}/);
  });
});
