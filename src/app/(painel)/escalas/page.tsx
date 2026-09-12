/**
 * Escala de turnos (migration 0043) — planejamento de quem trabalha quando.
 *
 * Separada de Atividades de propósito: aquela registra o que já aconteceu, esta
 * organiza o que vai acontecer. Misturar as duas numa tela só faria o campo
 * "data" significar coisas diferentes conforme a aba.
 */
import { listarEscala } from "./dados";
import { listarContextoAtividades } from "../atividades/dados";
import { buscarIdentidadeComite } from "../configuracoes/dados";
import { EscalasCliente } from "./escalas-cliente";

export const metadata = { title: "Escala de Turnos — Comitê Digital" };

export default async function EscalasPage() {
  const [turnos, contexto, identidade] = await Promise.all([
    listarEscala(),
    listarContextoAtividades(),
    buscarIdentidadeComite(),
  ]);

  return (
    <EscalasCliente
      turnosIniciais={turnos}
      pessoas={contexto.pessoas}
      regioes={contexto.regioes}
      vertical={identidade.vertical}
    />
  );
}
