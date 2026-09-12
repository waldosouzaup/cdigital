import { describe, it, expect } from "vitest";
import {
  MARCADORES_DISTRATO,
  TEMPLATE_DISTRATO_PADRAO,
  montarDadosDistrato,
  substituirMarcadoresDistrato,
} from "@/lib/contratos/template-distrato";
import {
  calcularProporcionalDistrato,
  montarTextoTermoDistrato,
} from "@/lib/contratos/distrato";

/**
 * O termo de distrato era texto fixo em `distrato.ts` — nenhum administrador
 * conseguia mexer nele. Passa a ser um modelo editável em
 * `/configuracoes?aba=modelos`, com os mesmos marcadores dos modelos de minuta
 * mais os que só existem na rescisão (motivo, proporcional, dias trabalhados).
 */
const calculo = calcularProporcionalDistrato({
  vigenciaInicio: "2026-01-01",
  vigenciaFim: "2026-01-31",
  dataDistrato: "2026-01-10",
  valor: 3100,
});

const dados = montarDadosDistrato({
  contratadoNome: "Maria Souza",
  contratadoCpf: "123.456.789-09",
  contratadoEndereco: "Rua A, 10",
  objeto: "Militância e Mobilização de Rua",
  motivo: "acordo entre as partes",
  calculo,
});

describe("substituirMarcadoresDistrato", () => {
  it("troca os marcadores de identificação do contratado", () => {
    const texto = substituirMarcadoresDistrato(
      "{{nome}} — CPF {{cpf}} — {{endereco}}",
      dados,
    );
    expect(texto).toBe("Maria Souza — CPF 123.456.789-09 — Rua A, 10");
  });

  it("troca os marcadores próprios da rescisão", () => {
    const texto = substituirMarcadoresDistrato(
      "{{motivo}} | {{data_distrato}} | {{valor_proporcional}} | {{dias_trabalhados}}/{{dias_totais}}",
      dados,
    );
    expect(texto).toBe("acordo entre as partes | 10/01/2026 | R$ 1.000,00 | 10/31");
  });

  it("escreve valores e datas por extenso", () => {
    const texto = substituirMarcadoresDistrato(
      "{{valor_proporcional_extenso}} em {{data_distrato_extenso}}",
      dados,
    );
    expect(texto).toContain("mil reais");
    expect(texto).toContain("10 de janeiro de 2026");
  });

  it("não reinterpreta marcador que venha dentro de um valor substituído", () => {
    const comInjecao = montarDadosDistrato({
      contratadoNome: "{{valor_proporcional}}",
      contratadoCpf: "000",
      contratadoEndereco: null,
      objeto: "Objeto",
      motivo: "motivo",
      calculo,
    });
    expect(substituirMarcadoresDistrato("{{nome}}", comInjecao)).toBe("{{valor_proporcional}}");
  });

  it("usa 'não informado' para endereço ausente e 'desacordo' para motivo vazio", () => {
    const semDados = montarDadosDistrato({
      contratadoNome: "Maria",
      contratadoCpf: "000",
      contratadoEndereco: null,
      objeto: "Objeto",
      motivo: "   ",
      calculo,
    });
    expect(substituirMarcadoresDistrato("{{endereco}}", semDados)).toBe("não informado");
    expect(substituirMarcadoresDistrato("{{motivo}}", semDados)).toBe("desacordo");
  });

  it("deixa intacto marcador desconhecido em vez de apagar o trecho", () => {
    expect(substituirMarcadoresDistrato("{{inexistente}}", dados)).toBe("{{inexistente}}");
  });
});

describe("TEMPLATE_DISTRATO_PADRAO", () => {
  it("preserva as quatro cláusulas e o fecho do termo oficial", () => {
    for (const trecho of ["Cláusula 1.", "Cláusula 2.", "Cláusula 3.", "Cláusula 4."]) {
      expect(TEMPLATE_DISTRATO_PADRAO).toContain(trecho);
    }
    expect(TEMPLATE_DISTRATO_PADRAO).toContain("CONTRATANTE");
    expect(TEMPLATE_DISTRATO_PADRAO).toContain("Testemunha 1");
  });

  it("não deixa nenhum marcador órfão depois da substituição", () => {
    const rendido = substituirMarcadoresDistrato(TEMPLATE_DISTRATO_PADRAO, dados);
    expect(rendido).not.toMatch(/\{\{[a-z_]+\}\}/);
  });

  it("declara na lista de marcadores todos os que o modelo padrão usa", () => {
    const usados = TEMPLATE_DISTRATO_PADRAO.match(/\{\{[a-z_]+\}\}/g) ?? [];
    const declarados = MARCADORES_DISTRATO.map((m) => m.marcador);
    for (const marcador of new Set(usados)) {
      expect(declarados).toContain(marcador);
    }
  });
});

/**
 * `montarTextoTermoDistrato` deixou de ser chamado em produção, mas continua
 * sendo a redação oficial escrita à mão e coberta por `distrato.test.ts`. Vale
 * como especificação executável: se o modelo padrão divergir dela, é porque
 * alguém mexeu no termo de fábrica sem querer.
 */
describe("equivalência com a redação oficial", () => {
  it("renderiza exatamente o texto que a rescisão gerava antes de o modelo existir", () => {
    const entrada = {
      contratadoNome: "Maria Souza",
      contratadoCpf: "123.456.789-09",
      contratadoEndereco: "Rua A, 10",
      motivo: "acordo entre as partes",
      calculo,
    };

    expect(substituirMarcadoresDistrato(
      TEMPLATE_DISTRATO_PADRAO,
      montarDadosDistrato({ ...entrada, objeto: "Militância e Mobilização de Rua" }),
    )).toBe(montarTextoTermoDistrato(entrada));
  });
});
