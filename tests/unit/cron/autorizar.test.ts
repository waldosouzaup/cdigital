import { describe, it, expect } from "vitest";
import { autorizarCron } from "@/lib/cron/autorizar";

/**
 * Fase 4, item 5 do gate: "Rota de cron sem CRON_SECRET responde 401".
 *
 * `autorizarCron` é a checagem pura que toda rota `/api/cron/*` faz antes de
 * qualquer trabalho: compara o cabeçalho `Authorization: Bearer <segredo>` com a
 * `CRON_SECRET` do ambiente, em tempo constante, e nega em qualquer situação de
 * dúvida (segredo não configurado, cabeçalho ausente, formato errado).
 */
describe("autorizarCron", () => {
  const SEGREDO = "a".repeat(64);

  it("aceita quando o cabeçalho traz exatamente 'Bearer <segredo>'", () => {
    expect(autorizarCron(`Bearer ${SEGREDO}`, SEGREDO)).toBe(true);
  });

  it("nega quando o cabeçalho está ausente", () => {
    expect(autorizarCron(null, SEGREDO)).toBe(false);
    expect(autorizarCron(undefined, SEGREDO)).toBe(false);
  });

  it("nega quando o token não corresponde ao segredo", () => {
    expect(autorizarCron(`Bearer ${"b".repeat(64)}`, SEGREDO)).toBe(false);
  });

  it("nega quando falta o prefixo 'Bearer '", () => {
    expect(autorizarCron(SEGREDO, SEGREDO)).toBe(false);
  });

  it("nega quando o token é apenas um prefixo do segredo (comprimento diferente)", () => {
    expect(autorizarCron(`Bearer ${SEGREDO.slice(0, 10)}`, SEGREDO)).toBe(false);
  });

  it("nega quando a CRON_SECRET não está configurada no ambiente", () => {
    expect(autorizarCron(`Bearer ${SEGREDO}`, undefined)).toBe(false);
    expect(autorizarCron("Bearer ", "")).toBe(false);
  });
});
