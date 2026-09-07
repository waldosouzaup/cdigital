import { describe, it, expect, vi } from "vitest";
import { sendNotification } from "@/lib/notificacoes/enviar";
import type { EmailTransport } from "@/lib/notificacoes/transporte";

/**
 * Fake mínimo do cliente Supabase, cobrindo só a cadeia de chamadas que
 * sendNotification usa: from().insert().select().single() e from().update().eq().
 */
function createFakeSupabase(options: {
  insertResult: { data: { id: string } | null; error: { code?: string; message?: string } | null };
  updateResult?: { error: { message?: string } | null };
}) {
  const calls: Record<string, unknown[]> = { insert: [], update: [], eq: [] };

  return {
    calls,
    from() {
      return {
        insert(payload: unknown) {
          calls.insert.push(payload);
          return {
            select() {
              return { single: async () => options.insertResult };
            },
          };
        },
        update(payload: unknown) {
          calls.update.push(payload);
          return {
            eq: async (_col: string, value: string) => {
              calls.eq.push(value);
              return options.updateResult ?? { error: null };
            },
          };
        },
      };
    },
  };
}

function createFakeTransport(result: Awaited<ReturnType<EmailTransport["send"]>>): EmailTransport {
  return { send: vi.fn(async () => result) };
}

const paramsBase = {
  organizationId: "org-1",
  type: "contrato_enviado" as const,
  recipientEmail: "contratado@exemplo.invalid",
  entity: "contratos",
  entityId: "contrato-123",
  idempotencyKey: "contrato_enviado:contrato-123",
  subject: "Você tem um contrato para assinar",
  html: "<p>Olá</p>",
  text: "Olá",
};

describe("sendNotification", () => {
  it("grava a notificação e envia quando a chave de idempotência é nova", async () => {
    const supabase = createFakeSupabase({ insertResult: { data: { id: "notif-1" }, error: null } });
    const transport = createFakeTransport({ ok: true, id: "resend-abc" });

    const result = await sendNotification({
      supabase: supabase as never,
      transport,
      ...paramsBase,
    });

    expect(result).toEqual({ sent: true });
    expect(transport.send).toHaveBeenCalledWith({
      to: paramsBase.recipientEmail,
      subject: paramsBase.subject,
      html: paramsBase.html,
      text: paramsBase.text,
    });
    expect(supabase.calls.update[0]).toMatchObject({ status: "enviada", resend_id: "resend-abc" });
  });

  it("não envia quando a chave de idempotência já existe (violação de unique)", async () => {
    const supabase = createFakeSupabase({
      insertResult: { data: null, error: { code: "23505", message: "duplicate key" } },
    });
    const transport = createFakeTransport({ ok: true, id: "resend-abc" });

    const result = await sendNotification({
      supabase: supabase as never,
      transport,
      ...paramsBase,
    });

    expect(result).toEqual({ sent: false, reason: "duplicate" });
    expect(transport.send).not.toHaveBeenCalled();
  });

  it("marca falhou quando o transporte de e-mail falha, sem derrubar a chamada", async () => {
    const supabase = createFakeSupabase({ insertResult: { data: { id: "notif-1" }, error: null } });
    const transport = createFakeTransport({ ok: false, error: "rate_limit_exceeded" });

    const result = await sendNotification({
      supabase: supabase as never,
      transport,
      ...paramsBase,
    });

    expect(result).toEqual({ sent: false, reason: "failed" });
    expect(supabase.calls.update[0]).toMatchObject({
      status: "falhou",
      erro: "rate_limit_exceeded",
      tentativas: 1,
    });
  });

  it("propaga erro se a inserção falhar por motivo diferente de duplicata", async () => {
    const supabase = createFakeSupabase({
      insertResult: { data: null, error: { code: "42501", message: "permission denied" } },
    });
    const transport = createFakeTransport({ ok: true, id: "resend-abc" });

    await expect(
      sendNotification({ supabase: supabase as never, transport, ...paramsBase }),
    ).rejects.toThrow();
    expect(transport.send).not.toHaveBeenCalled();
  });
});
