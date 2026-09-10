import { describe, it, expect } from "vitest";
import { posicaoAlcancada } from "@/lib/dashboard/agregacoes";
import type { ContractStatus } from "@/lib/contratos/maquina-estados";

export type EtapaFunil = "cadastrados" | "aptos" | "emitido" | "enviado" | "assinado";

export interface ItemFunilTeste {
  id: string;
  nomeCompleto: string;
  cpf: string;
  apta: boolean;
  statusContrato: ContractStatus | null;
  regiaoNome: string | null;
}

export function filtrarPorEtapaFunil(etapa: EtapaFunil, item: { apta: boolean; statusContrato: ContractStatus | null }): boolean {
  switch (etapa) {
    case "cadastrados":
      return true;
    case "aptos":
      return item.apta;
    case "emitido":
      return posicaoAlcancada(item.statusContrato) >= 1;
    case "enviado":
      return posicaoAlcancada(item.statusContrato) >= 2;
    case "assinado":
      return posicaoAlcancada(item.statusContrato) >= 3;
    default:
      return true;
  }
}

export function filtrarPorObjeto(
  filtroObjeto: string,
  item: { objeto: string | null; funcao: string | null; objetos?: string[] }
): boolean {
  if (filtroObjeto === "todos") return true;
  const alvo = filtroObjeto.toLowerCase().trim();
  return (
    item.objeto?.toLowerCase().trim() === alvo ||
    item.funcao?.toLowerCase().trim() === alvo ||
    Boolean(item.objetos?.some((o) => o.toLowerCase().trim() === alvo))
  );
}

describe("filtrarPorEtapaFunil", () => {
  const pessoasExemplo: ItemFunilTeste[] = [
    { id: "1", nomeCompleto: "Pessoa Sem Doc", cpf: "111", apta: false, statusContrato: null, regiaoNome: "Gama" },
    { id: "2", nomeCompleto: "Pessoa Apta Sem Contrato", cpf: "222", apta: true, statusContrato: null, regiaoNome: "Gama" },
    { id: "3", nomeCompleto: "Pessoa Rascunho", cpf: "333", apta: true, statusContrato: "rascunho", regiaoNome: "Ceilândia" },
    { id: "4", nomeCompleto: "Pessoa Emitido", cpf: "444", apta: true, statusContrato: "emitido", regiaoNome: "Ceilândia" },
    { id: "5", nomeCompleto: "Pessoa Enviado", cpf: "555", apta: true, statusContrato: "enviado", regiaoNome: "Taguatinga" },
    { id: "6", nomeCompleto: "Pessoa Assinado", cpf: "666", apta: true, statusContrato: "assinado", regiaoNome: "Taguatinga" },
  ];

  it("etapa cadastrados retorna todos", () => {
    const filtrados = pessoasExemplo.filter((p) => filtrarPorEtapaFunil("cadastrados", p));
    expect(filtrados.length).toBe(6);
  });

  it("etapa aptos retorna apenas pessoas com documentação apta", () => {
    const filtrados = pessoasExemplo.filter((p) => filtrarPorEtapaFunil("aptos", p));
    expect(filtrados.length).toBe(5);
    expect(filtrados.find((p) => p.id === "1")).toBeUndefined();
  });

  it("etapa emitido inclui contratos emitidos, enviados e assinados", () => {
    const filtrados = pessoasExemplo.filter((p) => filtrarPorEtapaFunil("emitido", p));
    expect(filtrados.length).toBe(3); // id 4 (emitido), id 5 (enviado), id 6 (assinado)
    expect(filtrados.map((p) => p.id)).toEqual(["4", "5", "6"]);
  });

  it("etapa enviado inclui contratos enviados e assinados", () => {
    const filtrados = pessoasExemplo.filter((p) => filtrarPorEtapaFunil("enviado", p));
    expect(filtrados.length).toBe(2); // id 5 (enviado), id 6 (assinado)
    expect(filtrados.map((p) => p.id)).toEqual(["5", "6"]);
  });

  it("etapa assinado inclui apenas contratos já assinados", () => {
    const filtrados = pessoasExemplo.filter((p) => filtrarPorEtapaFunil("assinado", p));
    expect(filtrados.length).toBe(1); // id 6 (assinado)
    expect(filtrados[0].id).toBe("6");
  });
});

describe("filtrarPorObjeto", () => {
  const pessoasComObjetos = [
    {
      id: "1",
      nomeCompleto: "Ana Montadora",
      objeto: "Administrativo e Montagem de Material",
      funcao: "Administrativo e Montagem de Material",
      objetos: ["Administrativo e Montagem de Material"],
    },
    {
      id: "2",
      nomeCompleto: "Bruno Homeoffice",
      objeto: "Administrativo Homeoffice",
      funcao: "Assistente Homeoffice",
      objetos: ["Administrativo Homeoffice"],
    },
    {
      id: "3",
      nomeCompleto: "Carlos Coordenador",
      objeto: "Coordenador de Comitê da Campanha",
      funcao: "Coordenador de Comitê da Campanha",
      objetos: ["Coordenador de Comitê da Campanha"],
    },
    {
      id: "4",
      nomeCompleto: "Daniela HistoricoDuplo",
      objeto: "Administrativo Homeoffice",
      funcao: "Administrativo Homeoffice",
      objetos: ["Administrativo e Montagem de Material", "Administrativo Homeoffice"],
    },
  ];

  it("filtro 'todos' retorna todas as pessoas", () => {
    const resultado = pessoasComObjetos.filter((p) => filtrarPorObjeto("todos", p));
    expect(resultado.length).toBe(4);
  });

  it("filtra corretamente por 'Administrativo e Montagem de Material'", () => {
    const resultado = pessoasComObjetos.filter((p) =>
      filtrarPorObjeto("Administrativo e Montagem de Material", p)
    );
    expect(resultado.length).toBe(2); // Ana (direto) e Daniela (histórico em objetos)
    expect(resultado.map((p) => p.id)).toEqual(["1", "4"]);
  });

  it("filtra de forma insensível a maiúsculas/minúsculas e espaços", () => {
    const resultado = pessoasComObjetos.filter((p) =>
      filtrarPorObjeto("  coordenador de comitê da campanha  ", p)
    );
    expect(resultado.length).toBe(1);
    expect(resultado[0].id).toBe("3");
  });

  it("retorna vazio se nenhum colaborador pertencer ao objeto", () => {
    const resultado = pessoasComObjetos.filter((p) =>
      filtrarPorObjeto("Objeto Inexistente", p)
    );
    expect(resultado.length).toBe(0);
  });
});
