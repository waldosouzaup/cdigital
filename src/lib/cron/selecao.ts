/**
 * Seleção de linhas para os jobs da Fase 4 (item 4) — lógica pura.
 *
 * Cada rota `/api/cron/*` busca do banco, filtra por estas funções e chama
 * `sendNotification` (o índice único de `chave_idempotencia` é quem garante o
 * "um único e-mail por contrato" do gate, mesmo o job rodando duas vezes no dia).
 */

// Status em que um contrato ainda está "vivo" o bastante para um alerta de
// vigência fazer sentido. rascunho: ainda não emitido, sem urgência. distratado/
// distrato_assinado/encerrado/cancelado: acabou, não há vigência a preservar.
const STATUS_ATIVOS = new Set(["emitido", "enviado", "assinado"]);

const UM_DIA_MS = 24 * 60 * 60 * 1000;

/** Diferença em dias inteiros entre duas datas ISO (`de` -> `ate`), UTC. */
function diasEntre(deIso: string, ateIso: string): number {
  const de = Date.parse(deIso.slice(0, 10) + "T00:00:00Z");
  const ate = Date.parse(ateIso.slice(0, 10) + "T00:00:00Z");
  return Math.round((ate - de) / UM_DIA_MS);
}

/** Dia útil = segunda a sexta. `dataIso` no formato YYYY-MM-DD. */
export function ehDiaUtil(dataIso: string): boolean {
  const diaSemana = new Date(dataIso.slice(0, 10) + "T12:00:00Z").getUTCDay();
  return diaSemana >= 1 && diaSemana <= 5;
}

export interface ContratoVigencia {
  id: string;
  status: string;
  vigenciaFim: string;
}

/**
 * Contratos a exatamente N dias do fim da vigência, para cada N em `prazos`
 * (Seção 9: 7 e 3 dias). O `prazo` volta junto para compor a chave de
 * idempotência (`vigencia_a_vencer:{id}:7d`).
 */
export function contratosAVencer(
  contratos: ContratoVigencia[],
  hojeIso: string,
  prazos: number[],
): { contratoId: string; prazo: number }[] {
  const resultado: { contratoId: string; prazo: number }[] = [];
  for (const contrato of contratos) {
    if (!STATUS_ATIVOS.has(contrato.status)) continue;
    const restam = diasEntre(hojeIso, contrato.vigenciaFim);
    for (const prazo of prazos) {
      if (restam === prazo) resultado.push({ contratoId: contrato.id, prazo });
    }
  }
  return resultado;
}

export interface ContratoEnvio {
  id: string;
  status: string;
  enviadoEm: string | null;
}

/** Contratos parados em `enviado` há exatamente 3 dias (Seção 9). */
export function contratosParaLembrete(contratos: ContratoEnvio[], hojeIso: string): string[] {
  return contratos
    .filter(
      (c) => c.status === "enviado" && c.enviadoEm != null && diasEntre(c.enviadoEm, hojeIso) === 3,
    )
    .map((c) => c.id);
}

/** Reprocessa notificação que ficou em `falhou` e ainda não esgotou as tentativas. */
export function deveReprocessarNotificacao(
  notificacao: { status: string; tentativas: number },
  maxTentativas: number,
): boolean {
  return notificacao.status === "falhou" && notificacao.tentativas < maxTentativas;
}
