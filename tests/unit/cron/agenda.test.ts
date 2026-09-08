import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import {
  horaBrasiliaParaUtc,
  dataEmSaoPaulo,
  CRON_RESUMO_DIARIO,
  CRON_VIGENCIA_A_VENCER,
  CRON_LEMBRETE_ASSINATURA,
  CRON_REPROCESSAR_NOTIFICACOES,
} from "@/lib/cron/agenda";

/**
 * Fase 4, item 4 + gate "Fuso horário correto: o resumo das 8h de Brasília não sai
 * às 5h nem às 11h".
 *
 * `pg_cron` agenda em UTC. O Brasil não tem horário de verão desde 2019, então
 * America/Sao_Paulo é UTC-3 o ano inteiro: 08:00 em Brasília = 11:00 UTC.
 */
describe("horaBrasiliaParaUtc", () => {
  it("converte 08h de Brasília para 11h UTC", () => {
    expect(horaBrasiliaParaUtc(8)).toBe(11);
  });

  it("não devolve 5h (naive: tratar a hora local como se fosse UTC) nem a própria hora", () => {
    expect(horaBrasiliaParaUtc(8)).not.toBe(5);
    expect(horaBrasiliaParaUtc(8)).not.toBe(8);
  });

  it("dá a volta no relógio quando a soma passa de 24", () => {
    expect(horaBrasiliaParaUtc(22)).toBe(1);
    expect(horaBrasiliaParaUtc(23)).toBe(2);
  });
});

describe("dataEmSaoPaulo", () => {
  it("devolve a data-calendário local de São Paulo (UTC-3), não a data UTC", () => {
    // 01:00Z ainda é o dia anterior às 22:00 em São Paulo
    expect(dataEmSaoPaulo(new Date("2026-09-08T01:00:00Z"))).toBe("2026-09-07");
    // 12:00Z já é 09:00 do mesmo dia em São Paulo
    expect(dataEmSaoPaulo(new Date("2026-09-08T12:00:00Z"))).toBe("2026-09-08");
  });
});

describe("expressões cron dos 4 jobs da Fase 4", () => {
  it("resumo diário: 08h America/Sao_Paulo, só dias úteis => '0 11 * * 1-5'", () => {
    expect(CRON_RESUMO_DIARIO).toBe("0 11 * * 1-5");
  });

  it("vigência a vencer: uma vez por dia, em hora fixa", () => {
    expect(CRON_VIGENCIA_A_VENCER).toMatch(/^\d+ \d+ \* \* \*$/);
  });

  it("lembrete de assinatura: uma vez por dia, em hora fixa", () => {
    expect(CRON_LEMBRETE_ASSINATURA).toMatch(/^\d+ \d+ \* \* \*$/);
  });

  it("reprocessamento de notificações falhou: em intervalo curto (a cada N minutos)", () => {
    expect(CRON_REPROCESSAR_NOTIFICACOES).toMatch(/^\*\/\d+ \* \* \* \*$/);
  });

  it("a migration 0011 agenda exatamente estas mesmas expressões (guarda contra drift)", () => {
    const sql = readFileSync("supabase/migrations/0011_pg_cron_jobs.sql", "utf8");
    for (const expressao of [
      CRON_RESUMO_DIARIO,
      CRON_VIGENCIA_A_VENCER,
      CRON_LEMBRETE_ASSINATURA,
      CRON_REPROCESSAR_NOTIFICACOES,
    ]) {
      expect(sql).toContain(`'${expressao}'`);
    }
  });
});
