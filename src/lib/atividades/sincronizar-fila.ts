/**
 * Sincronização da fila offline de registros de atividade — Fase 4, item 2.
 *
 * Orquestrador puro: itera a fila local (IndexedDB), tenta enviar cada item pela
 * Server Action e remove os que subiram. Um item rejeitado pelo servidor como
 * inválido (`descartavel: true`) é removido para não ficar preso na fila para
 * sempre; uma falha transitória (rede, 5xx) é mantida para a próxima tentativa.
 */
import type { EntradaRegistroAtividade } from "./registro-rapido";

export interface ItemFila {
  id: number;
  criadoEm: string;
  entrada: EntradaRegistroAtividade;
}

export interface ResultadoEnvioItem {
  ok: boolean;
  /** true = o servidor recusou o conteúdo; não adianta reenviar. */
  descartavel?: boolean;
}

export interface SincronizarFilaDeps {
  lerFila: () => Promise<ItemFila[]>;
  enviar: (entrada: EntradaRegistroAtividade) => Promise<ResultadoEnvioItem>;
  remover: (id: number) => Promise<void>;
}

export interface ResultadoSincronizacao {
  enviados: number;
  mantidos: number;
  descartados: number;
}

export async function sincronizarFila(
  deps: SincronizarFilaDeps,
): Promise<ResultadoSincronizacao> {
  const fila = await deps.lerFila();
  let enviados = 0;
  let mantidos = 0;
  let descartados = 0;

  for (const item of fila) {
    let resultado: ResultadoEnvioItem;
    try {
      resultado = await deps.enviar(item.entrada);
    } catch {
      resultado = { ok: false };
    }

    if (resultado.ok) {
      await deps.remover(item.id);
      enviados += 1;
    } else if (resultado.descartavel) {
      await deps.remover(item.id);
      descartados += 1;
    } else {
      mantidos += 1;
    }
  }

  return { enviados, mantidos, descartados };
}
