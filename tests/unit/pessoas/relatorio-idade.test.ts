import { describe, expect, it } from "vitest";
import {
  calcularIdade,
  computarRelatorioIdade,
  type ItemPessoaIdade,
} from "@/lib/pessoas/relatorio-idade";

describe("calcularIdade", () => {
  it("calcula a idade corretamente a partir de string YYYY-MM-DD", () => {
    const hoje = new Date();
    const anoNasc = hoje.getFullYear() - 30;
    const mes = String(hoje.getMonth() + 1).padStart(2, "0");
    const dia = String(hoje.getDate()).padStart(2, "0");

    const idade = calcularIdade(`${anoNasc}-${mes}-${dia}`);
    expect(idade).toBe(30);
  });

  it("retorna null para valores vazios ou inválidos", () => {
    expect(calcularIdade(null)).toBeNull();
    expect(calcularIdade(undefined)).toBeNull();
    expect(calcularIdade("")).toBeNull();
    expect(calcularIdade("data-invalida")).toBeNull();
  });
});

describe("computarRelatorioIdade", () => {
  const pessoasExemplo: ItemPessoaIdade[] = [
    {
      id: "1",
      nomeCompleto: "Ana",
      funcao: "Administrativo",
      regiaoNome: "Ceilândia",
      idade: 20,
    },
    {
      id: "2",
      nomeCompleto: "Bruno",
      funcao: "Administrativo",
      regiaoNome: "Ceilândia",
      idade: 30,
    },
    {
      id: "3",
      nomeCompleto: "Carlos",
      funcao: "Administrativo",
      regiaoNome: "Taguatinga",
      idade: 40,
    },
    {
      id: "4",
      nomeCompleto: "Daniela",
      funcao: "Militância",
      regiaoNome: "Ceilândia",
      idade: 50,
    },
    {
      id: "5",
      nomeCompleto: "Eduardo Sem Idade",
      funcao: "Militância",
      regiaoNome: "Ceilândia",
      idade: null,
    },
  ];

  it("calcula corretamente as médias por Função e Região", () => {
    const relatorio = computarRelatorioIdade(pessoasExemplo);

    expect(relatorio.totalGeralTrabalhadores).toBe(5);
    expect(relatorio.totalGeralComIdade).toBe(4);
    // (20 + 30 + 40 + 50) / 4 = 140 / 4 = 35.0
    expect(relatorio.mediaGeralIdade).toBe(35);
    expect(relatorio.idadeMinimaGeral).toBe(20);
    expect(relatorio.idadeMaximaGeral).toBe(50);

    // Linha Administrativo × Ceilândia
    const adminCeilandia = relatorio.linhas.find(
      (l) => l.funcao === "Administrativo" && l.regiaoNome === "Ceilândia",
    );
    expect(adminCeilandia).toBeDefined();
    expect(adminCeilandia?.totalTrabalhadores).toBe(2);
    expect(adminCeilandia?.totalComIdade).toBe(2);
    // (20 + 30) / 2 = 25.0
    expect(adminCeilandia?.mediaIdade).toBe(25);
    expect(adminCeilandia?.idadeMinima).toBe(20);
    expect(adminCeilandia?.idadeMaxima).toBe(30);

    // Linha Militância × Ceilândia (com 1 pessoa sem idade)
    const militanciaCeilandia = relatorio.linhas.find(
      (l) => l.funcao === "Militância" && l.regiaoNome === "Ceilândia",
    );
    expect(militanciaCeilandia).toBeDefined();
    expect(militanciaCeilandia?.totalTrabalhadores).toBe(2);
    expect(militanciaCeilandia?.totalComIdade).toBe(1);
    expect(militanciaCeilandia?.mediaIdade).toBe(50);
  });

  it("filtra por Função específica", () => {
    const relatorio = computarRelatorioIdade(pessoasExemplo, { funcao: "Militância" });
    expect(relatorio.totalGeralTrabalhadores).toBe(2);
    expect(relatorio.linhas.every((l) => l.funcao === "Militância")).toBe(true);
  });

  it("filtra por Região específica", () => {
    const relatorio = computarRelatorioIdade(pessoasExemplo, { regiao: "Taguatinga" });
    expect(relatorio.totalGeralTrabalhadores).toBe(1);
    expect(relatorio.linhas[0].regiaoNome).toBe("Taguatinga");
    expect(relatorio.linhas[0].mediaIdade).toBe(40);
  });

  it("retorna lista vazia caso não haja pessoas", () => {
    const relatorio = computarRelatorioIdade([]);
    expect(relatorio.linhas).toEqual([]);
    expect(relatorio.totalGeralTrabalhadores).toBe(0);
    expect(relatorio.mediaGeralIdade).toBeNull();
  });
});
