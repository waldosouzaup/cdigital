import { describe, it, expect } from "vitest";
import {
  ehDiaUtil,
  contratosAVencer,
  contratosParaLembrete,
  deveReprocessarNotificacao,
} from "@/lib/cron/selecao";

/**
 * Fase 4, item 4: quais linhas cada job age. Lógica pura — a rota de cron só busca
 * do banco, passa por estas funções e chama `sendNotification` (que já garante
 * "um único e-mail por contrato" pelo índice único de chave_idempotencia).
 */
describe("ehDiaUtil", () => {
  it("segunda a sexta são dias úteis", () => {
    expect(ehDiaUtil("2026-09-07")).toBe(true); // segunda
    expect(ehDiaUtil("2026-09-11")).toBe(true); // sexta
  });

  it("sábado e domingo não são", () => {
    expect(ehDiaUtil("2026-09-12")).toBe(false); // sábado
    expect(ehDiaUtil("2026-09-13")).toBe(false); // domingo
  });
});

describe("contratosAVencer", () => {
  const base = (over: Partial<{ id: string; status: string; vigenciaFim: string }>) => ({
    id: "c1",
    status: "assinado",
    vigenciaFim: "2026-10-03",
    ...over,
  });

  it("sinaliza o contrato exatamente a 7 e a 3 dias do fim da vigência", () => {
    const contratos = [
      base({ id: "faltam-7", vigenciaFim: "2026-10-10" }),
      base({ id: "faltam-3", vigenciaFim: "2026-10-06" }),
      base({ id: "faltam-5", vigenciaFim: "2026-10-08" }),
    ];
    const res = contratosAVencer(contratos, "2026-10-03", [7, 3]);
    expect(res).toEqual([
      { contratoId: "faltam-7", prazo: 7 },
      { contratoId: "faltam-3", prazo: 3 },
    ]);
  });

  it("ignora contratos já encerrados, distratados ou cancelados", () => {
    const contratos = [
      base({ id: "distratado", status: "distratado", vigenciaFim: "2026-10-10" }),
      base({ id: "cancelado", status: "cancelado", vigenciaFim: "2026-10-10" }),
      base({ id: "encerrado", status: "encerrado", vigenciaFim: "2026-10-10" }),
    ];
    expect(contratosAVencer(contratos, "2026-10-03", [7, 3])).toEqual([]);
  });

  it("não sinaliza contrato cuja vigência já passou", () => {
    const contratos = [base({ id: "vencido", vigenciaFim: "2026-09-30" })];
    expect(contratosAVencer(contratos, "2026-10-03", [7, 3])).toEqual([]);
  });
});

describe("contratosParaLembrete", () => {
  it("sinaliza contrato em 'enviado' há exatamente 3 dias", () => {
    const contratos = [
      { id: "ha-3-dias", status: "enviado", enviadoEm: "2026-09-05T10:00:00Z" },
      { id: "ha-1-dia", status: "enviado", enviadoEm: "2026-09-07T10:00:00Z" },
      { id: "ha-3-mas-assinado", status: "assinado", enviadoEm: "2026-09-05T10:00:00Z" },
    ];
    expect(contratosParaLembrete(contratos, "2026-09-08")).toEqual(["ha-3-dias"]);
  });

  it("ignora contrato sem data de envio", () => {
    const contratos = [{ id: "sem-data", status: "enviado", enviadoEm: null }];
    expect(contratosParaLembrete(contratos, "2026-09-08")).toEqual([]);
  });
});

describe("deveReprocessarNotificacao", () => {
  it("reprocessa quem falhou e ainda tem tentativas", () => {
    expect(deveReprocessarNotificacao({ status: "falhou", tentativas: 1 }, 3)).toBe(true);
  });

  it("não reprocessa quem já esgotou as tentativas", () => {
    expect(deveReprocessarNotificacao({ status: "falhou", tentativas: 3 }, 3)).toBe(false);
  });

  it("não reprocessa quem não está em 'falhou'", () => {
    expect(deveReprocessarNotificacao({ status: "enviada", tentativas: 0 }, 3)).toBe(false);
    expect(deveReprocessarNotificacao({ status: "bounce", tentativas: 0 }, 3)).toBe(false);
  });
});
