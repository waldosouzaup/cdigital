/**
 * Agenda dos jobs de `pg_cron` — Fase 4, item 4.
 *
 * `pg_cron` agenda sempre em UTC. O Brasil não observa horário de verão desde
 * 2019, então America/Sao_Paulo é UTC-3 o ano todo — a conversão é uma soma fixa,
 * não depende de tabela de fuso.
 *
 * As expressões abaixo são a fonte única: a migration 0011 as usa em
 * `cron.schedule`, e o teste as compara com o que a Seção 9 descreve em linguagem
 * humana ("8h America/Sao_Paulo", "dias úteis").
 */

const OFFSET_BRASILIA_HORAS = 3; // UTC-3, fixo (sem DST desde 2019)

/** Hora "de parede" em Brasília -> hora UTC correspondente (0–23, com volta no dia). */
export function horaBrasiliaParaUtc(horaBrasilia: number): number {
  return (horaBrasilia + OFFSET_BRASILIA_HORAS) % 24;
}

/**
 * Data-calendário (YYYY-MM-DD) local de São Paulo para um instante. Um job que
 * roda às 00:30 UTC ainda está no dia anterior em Brasília — o resumo diário e os
 * alertas de vigência precisam raciocinar sobre o dia de lá, não o dia UTC.
 */
export function dataEmSaoPaulo(agora: Date = new Date()): string {
  // en-CA formata como YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(agora);
}

// 08:00 America/Sao_Paulo = 11:00 UTC. Dias úteis = 1-5 (segunda a sexta) no
// campo de dia-da-semana do cron.
export const CRON_RESUMO_DIARIO = `0 ${horaBrasiliaParaUtc(8)} * * 1-5`;

// Alertas de vigência: uma vez por dia. 07:00 Brasília (10:00 UTC) — antes do
// resumo diário das 8h, para o resumo já refletir o que foi disparado.
export const CRON_VIGENCIA_A_VENCER = `0 ${horaBrasiliaParaUtc(7)} * * *`;

// Lembrete de assinatura: uma vez por dia, logo depois da vigência.
export const CRON_LEMBRETE_ASSINATURA = `15 ${horaBrasiliaParaUtc(7)} * * *`;

// Reprocessamento de notificações que falharam: a cada 15 minutos, o dia todo.
export const CRON_REPROCESSAR_NOTIFICACOES = "*/15 * * * *";

// Manter o banco ativo (evitar a pausa por inatividade do Supabase): uma vez por
// dia, de madrugada, antes de todos os outros — só existe para garantir a
// chamada externa à API do Supabase mesmo se os jobs de negócio acima forem
// desligados ou não encontrarem nada para fazer num dia (ver migration 0033).
export const CRON_MANTER_BANCO_ATIVO = `0 ${horaBrasiliaParaUtc(4)} * * *`;
