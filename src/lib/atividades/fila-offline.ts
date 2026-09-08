/**
 * Fila local de registros de atividade em IndexedDB — Fase 4, item 2.
 *
 * Só roda no navegador. Guarda o que foi registrado sem rede; `sincronizar-fila.ts`
 * (lógica pura, testada) concilia esta fila com o servidor quando o sinal volta.
 * Enquanto um item está aqui, ele ainda não subiu — é o "indicador honesto do que
 * ainda não subiu" que o item 2 pede.
 */
import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { EntradaRegistroAtividade } from "./registro-rapido";
import type { ItemFila } from "./sincronizar-fila";

const DB_NOME = "comite-campo";
const STORE = "fila-atividades";

interface FilaDB extends DBSchema {
  "fila-atividades": {
    key: number;
    value: { id?: number; criadoEm: string; entrada: EntradaRegistroAtividade };
  };
}

let promessaDb: Promise<IDBPDatabase<FilaDB>> | null = null;

function abrir(): Promise<IDBPDatabase<FilaDB>> {
  if (!promessaDb) {
    promessaDb = openDB<FilaDB>(DB_NOME, 1, {
      upgrade(db) {
        db.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
      },
    });
  }
  return promessaDb;
}

export async function enfileirarAtividade(entrada: EntradaRegistroAtividade): Promise<number> {
  const db = await abrir();
  return (await db.add(STORE, { criadoEm: new Date().toISOString(), entrada })) as number;
}

export async function lerFilaAtividades(): Promise<ItemFila[]> {
  const db = await abrir();
  return (await db.getAll(STORE)) as ItemFila[];
}

export async function removerDaFila(id: number): Promise<void> {
  const db = await abrir();
  await db.delete(STORE, id);
}

export async function contarFila(): Promise<number> {
  const db = await abrir();
  return db.count(STORE);
}
