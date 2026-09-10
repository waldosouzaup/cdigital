import { describe, it, expect } from "vitest";
import { gerarJanelaPaginas } from "@/components/paginacao";

describe("gerarJanelaPaginas", () => {
  it("deve retornar [1] quando houver apenas 1 página", () => {
    expect(gerarJanelaPaginas(1, 1)).toEqual([1]);
  });

  it("deve retornar todas as páginas quando totalPaginas <= 7", () => {
    expect(gerarJanelaPaginas(1, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(gerarJanelaPaginas(4, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("deve adicionar reticências à direita quando estiver no início de muitas páginas", () => {
    const janela = gerarJanelaPaginas(1, 15);
    expect(janela).toEqual([1, 2, "...", 15]);
  });

  it("deve adicionar reticências à esquerda e à direita quando estiver no meio", () => {
    const janela = gerarJanelaPaginas(8, 15);
    expect(janela).toEqual([1, "...", 7, 8, 9, "...", 15]);
  });

  it("deve adicionar reticências à esquerda quando estiver no final", () => {
    const janela = gerarJanelaPaginas(15, 15);
    expect(janela).toEqual([1, "...", 14, 15]);
  });

  it("deve respeitar a margem adjacente personalizada", () => {
    const janela = gerarJanelaPaginas(10, 20, 2);
    expect(janela).toEqual([1, "...", 8, 9, 10, 11, 12, "...", 20]);
  });
});

describe("cálculos de fatiamento de página", () => {
  function calcularFatiamento(totalItens: number, paginaAtual: number, itensPorPagina: number) {
    const totalPaginas = Math.max(1, Math.ceil(totalItens / itensPorPagina));
    const paginaAjustada = Math.min(Math.max(1, paginaAtual), totalPaginas);
    const inicio = (paginaAjustada - 1) * itensPorPagina;
    const fim = Math.min(inicio + itensPorPagina, totalItens);
    const de = totalItens === 0 ? 0 : inicio + 1;
    const ate = fim;

    return { totalPaginas, paginaAjustada, inicio, fim, de, ate };
  }

  it("calcula corretamente intervalos na primeira página", () => {
    const res = calcularFatiamento(45, 1, 20);
    expect(res.totalPaginas).toBe(3);
    expect(res.inicio).toBe(0);
    expect(res.fim).toBe(20);
    expect(res.de).toBe(1);
    expect(res.ate).toBe(20);
  });

  it("calcula corretamente intervalos na última página com sobra", () => {
    const res = calcularFatiamento(45, 3, 20);
    expect(res.totalPaginas).toBe(3);
    expect(res.inicio).toBe(40);
    expect(res.fim).toBe(45);
    expect(res.de).toBe(41);
    expect(res.ate).toBe(45);
  });

  it("ajusta página além do limite se a lista encolher", () => {
    const res = calcularFatiamento(15, 5, 10);
    expect(res.totalPaginas).toBe(2);
    expect(res.paginaAjustada).toBe(2);
    expect(res.de).toBe(11);
    expect(res.ate).toBe(15);
  });

  it("lida com lista vazia", () => {
    const res = calcularFatiamento(0, 1, 20);
    expect(res.totalPaginas).toBe(1);
    expect(res.inicio).toBe(0);
    expect(res.fim).toBe(0);
    expect(res.de).toBe(0);
    expect(res.ate).toBe(0);
  });
});
