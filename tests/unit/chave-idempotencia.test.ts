import { describe, it, expect } from "vitest";
import { idempotencyKey } from "@/lib/notificacoes/chave-idempotencia";

// Seção 6.1 e Seção 12: "mesma entrada produz sempre a mesma chave".
describe("idempotencyKey", () => {
  it("gera a mesma chave para a mesma entrada", () => {
    const a = idempotencyKey("contrato_enviado", "contrato-123");
    const b = idempotencyKey("contrato_enviado", "contrato-123");
    expect(a).toBe(b);
  });

  it("segue o formato tipo:entidade_id do exemplo da Seção 6", () => {
    expect(idempotencyKey("contrato_enviado", "contrato-123")).toBe(
      "contrato_enviado:contrato-123",
    );
  });

  it("aceita segmentos extras, como o prazo em vigencia_a_vencer", () => {
    expect(idempotencyKey("vigencia_a_vencer", "contrato-123", "7d")).toBe(
      "vigencia_a_vencer:contrato-123:7d",
    );
  });

  it("diferencia por tipo mesmo com a mesma entidade", () => {
    const enviado = idempotencyKey("contrato_enviado", "contrato-123");
    const lembrete = idempotencyKey("lembrete_assinatura", "contrato-123");
    expect(enviado).not.toBe(lembrete);
  });

  it("diferencia por entidade mesmo com o mesmo tipo", () => {
    const a = idempotencyKey("contrato_enviado", "contrato-123");
    const b = idempotencyKey("contrato_enviado", "contrato-456");
    expect(a).not.toBe(b);
  });
});
