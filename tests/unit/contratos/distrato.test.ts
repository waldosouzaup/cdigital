import { describe, it, expect } from "vitest";
import {
  calcularDiasCorridosInclusivos,
  calcularProporcionalDistrato,
  montarTextoTermoDistrato,
  formatarDataPorExtenso,
  formatarDataBR,
} from "@/lib/contratos/distrato";

describe("Cálculos e Geração do Termo de Distrato", () => {
  it("calcula corretamente os dias corridos de forma inclusiva", () => {
    // 01/09/2026 a 03/10/2026 = 33 dias
    expect(calcularDiasCorridosInclusivos("2026-09-01", "2026-10-03")).toBe(33);
    // 01/09/2026 a 07/09/2026 = 7 dias
    expect(calcularDiasCorridosInclusivos("2026-09-01", "2026-09-07")).toBe(7);
    // 01/09/2026 a 10/09/2026 = 10 dias
    expect(calcularDiasCorridosInclusivos("2026-09-01", "2026-09-10")).toBe(10);
    // Mesmo dia = 1 dia
    expect(calcularDiasCorridosInclusivos("2026-09-01", "2026-09-01")).toBe(1);
  });

  it("calcula o valor proporcional exato do PDF modelo (7 dias de 33 dias para R$ 3.553,00)", () => {
    const calc = calcularProporcionalDistrato({
      vigenciaInicio: "2026-09-01",
      vigenciaFim: "2026-10-03",
      dataDistrato: "2026-09-07",
      valor: 3553,
    });

    expect(calc.diasTotais).toBe(33);
    expect(calc.diasTotaisExtenso).toBe("trinta e três");
    expect(calc.diasTrabalhados).toBe(7);
    expect(calc.diasTrabalhadosExtenso).toBe("sete");
    expect(calc.valorProporcional).toBe(753.67);
    expect(calc.valorProporcionalExtenso).toBe(
      "setecentos e cinquenta e três reais e sessenta e sete centavos",
    );
    expect(calc.dataDistratoFormatada).toBe("07/09/2026");
    expect(calc.dataDistratoExtenso).toBe("07 de setembro de 2026");
  });

  it("calcula o valor proporcional do exemplo do usuário (10 dias de 33 dias para R$ 3.553,00)", () => {
    const calc = calcularProporcionalDistrato({
      vigenciaInicio: "2026-09-01",
      vigenciaFim: "2026-10-03",
      dataDistrato: "2026-09-10",
      valor: 3553,
    });

    expect(calc.diasTotais).toBe(33);
    expect(calc.diasTrabalhados).toBe(10);
    expect(calc.diasTrabalhadosExtenso).toBe("dez");
    expect(calc.valorProporcional).toBe(1076.67);
    expect(calc.valorProporcionalExtenso).toBe(
      "mil e setenta e seis reais e sessenta e sete centavos",
    );
    expect(calc.dataDistratoFormatada).toBe("10/09/2026");
  });

  it("monta o texto do termo contendo todas as cláusulas do modelo oficial", () => {
    const calc = calcularProporcionalDistrato({
      vigenciaInicio: "2026-09-01",
      vigenciaFim: "2026-10-03",
      dataDistrato: "2026-09-07",
      valor: 3553,
    });

    const texto = montarTextoTermoDistrato({
      contratadoNome: "ANNA CÉLIA SILVA DE ALMEIDA",
      contratadoCpf: "023.821.201-77",
      contratadoEndereco: "Quadra 18, Conjunto L, Casa 59B – CEP 73368-564 – BRASÍLIA/DF",
      motivo: "desacordo",
      calculo: calc,
    });

    expect(texto).toContain("CONTRATANTE: ELEIÇÃO 2026 MICHELLE DE PAULA FIRMO REINALDO BOLSONARO");
    expect(texto).toContain("ANNA CÉLIA SILVA DE ALMEIDA");
    expect(texto).toContain("023.821.201-77");
    expect(texto).toContain("Cláusula 1. Por este instrumento particular, consignam as partes, em razão de desacordo, distratam, na data 07/09/2026, os termos do contrato assinado em 01/09/2026");
    expect(texto).toContain("Cláusula 2. – O(A) CONTRATADO(A) declara que recebeu o valor de R$ 753,67 (setecentos e cinquenta e três reais e sessenta e sete centavos), proporcional aos 7 (sete) dias efetivamente trabalhados no período de 01/09/2026 a 07/09/2026, com base no valor mensal dividido pelos 33 (trinta e três) dias corridos do período contratual (01/09/2026 a 03/10/2026)");
    expect(texto).toContain("Cláusula 3. – A CONTRATANTE declara que recebeu todos os serviços");
    expect(texto).toContain("Cláusula 4. – Fica eleito o Foro da cidade de BRASÍLIA/DF");
    expect(texto).toContain("BRASÍLIA, 07 de setembro de 2026.");
    expect(texto).toContain("Testemunha 1:");
    expect(texto).toContain("Testemunha 2:");
  });

  it("formata datas por extenso corretamente em português", () => {
    expect(formatarDataPorExtenso("2026-09-07")).toBe("07 de setembro de 2026");
    expect(formatarDataPorExtenso("2026-09-10")).toBe("10 de setembro de 2026");
    expect(formatarDataBR("2026-09-07")).toBe("07/09/2026");
  });
});
