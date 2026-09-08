import { describe, it, expect, vi } from "vitest";
import { sincronizarFila, type ItemFila } from "@/lib/atividades/sincronizar-fila";

/**
 * Fase 4, item 2 — "sincronização automática ao voltar o sinal". Orquestrador
 * puro: recebe a fila (IndexedDB), um `enviar` (a Server Action) e um `remover`,
 * e concilia. Testado com dublês; a cola com o IndexedDB fica em `fila-offline.ts`.
 */
function item(id: number): ItemFila {
  return {
    id,
    criadoEm: "2026-09-08T10:00:00Z",
    entrada: {
      pessoaId: `p${id}`,
      tipo: "Panfletagem",
      quantidade: 100,
      data: "2026-09-08",
    },
  };
}

describe("sincronizarFila", () => {
  it("não faz nada com a fila vazia", async () => {
    const enviar = vi.fn();
    const remover = vi.fn();
    const res = await sincronizarFila({ lerFila: async () => [], enviar, remover });
    expect(res).toEqual({ enviados: 0, mantidos: 0, descartados: 0 });
    expect(enviar).not.toHaveBeenCalled();
  });

  it("envia todos os itens e os remove da fila quando a rede responde", async () => {
    const remover = vi.fn<(id: number) => Promise<void>>(async () => {});
    const enviar = vi.fn(async () => ({ ok: true }));

    const res = await sincronizarFila({
      lerFila: async () => [item(1), item(2)],
      enviar,
      remover,
    });

    expect(res).toEqual({ enviados: 2, mantidos: 0, descartados: 0 });
    expect(enviar).toHaveBeenCalledTimes(2);
    expect(remover.mock.calls.map((c) => c[0])).toEqual([1, 2]);
  });

  it("mantém na fila o item cujo envio falhou de forma transitória", async () => {
    const remover = vi.fn<(id: number) => Promise<void>>(async () => {});
    const enviar = vi.fn(async (entrada: { pessoaId: string }) =>
      entrada.pessoaId === "p1" ? { ok: true } : { ok: false },
    );

    const res = await sincronizarFila({
      lerFila: async () => [item(1), item(2)],
      enviar,
      remover,
    });

    expect(res).toEqual({ enviados: 1, mantidos: 1, descartados: 0 });
    expect(remover).toHaveBeenCalledTimes(1);
    expect(remover).toHaveBeenCalledWith(1);
  });

  it("descarta (remove) o item que o servidor rejeitou como inválido, sem retê-lo para sempre", async () => {
    const remover = vi.fn<(id: number) => Promise<void>>(async () => {});
    const enviar = vi.fn(async () => ({ ok: false, descartavel: true }));

    const res = await sincronizarFila({
      lerFila: async () => [item(9)],
      enviar,
      remover,
    });

    expect(res).toEqual({ enviados: 0, mantidos: 0, descartados: 1 });
    expect(remover).toHaveBeenCalledWith(9);
  });
});
