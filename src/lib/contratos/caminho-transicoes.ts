/**
 * Caminho de transições — usado por `src/db/seed.ts` para levar um contrato recém-
 * criado até um status final, passando por todo estado intermediário exigido pela
 * máquina de estados (Seção 7), gravando um evento por passo.
 *
 * Escopo deliberadamente restrito às cadeias que o seed usa (Seção 11): não cobre
 * `cancelado` nem `encerrado`. Cobrir esses exigiria decidir de qual ponto da cadeia
 * o cancelamento parte, o que o seed não precisa — melhor lançar erro claro do que
 * adivinhar um caminho.
 */
import type { ContractStatus } from "./maquina-estados";

const MAIN_CHAIN: ContractStatus[] = ["rascunho", "emitido", "enviado", "assinado"];
const TERMINATION_CHAIN: ContractStatus[] = [...MAIN_CHAIN, "distratado", "distrato_assinado"];

/**
 * Retorna a sequência de estados entre `from` (exclusivo) e `to` (inclusivo).
 * Cada par consecutivo do resultado — e o par (from, primeiro item) — é garantido
 * uma transição válida por `canTransition` (testado explicitamente).
 */
export function buildTransitionPath(from: ContractStatus, to: ContractStatus): ContractStatus[] {
  const chain = to === "distratado" || to === "distrato_assinado" ? TERMINATION_CHAIN : MAIN_CHAIN;

  const fromIndex = chain.indexOf(from);
  const toIndex = chain.indexOf(to);

  if (fromIndex === -1 || toIndex === -1) {
    throw new Error(
      `buildTransitionPath não cobre o alvo "${to}" a partir de "${from}" — só a cadeia ` +
        `principal (rascunho→emitido→enviado→assinado) e a extensão de distrato são suportadas.`,
    );
  }

  return chain.slice(fromIndex + 1, toIndex + 1);
}
