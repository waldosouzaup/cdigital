import { describe, it, expect, vi } from "vitest";
import { reprocessarNotificacoesFalhas } from "@/lib/notificacoes/reprocessar";
import type { EmailTransport } from "@/lib/notificacoes/transporte";

/**
 * Fase 4, item 4: "reprocessamento de notificações `falhou`" + Seção 6, regra 4
 * ("um job tenta de novo, no máximo 3 tentativas").
 *
 * O payload de reenvio (subject/html/text) fica guardado na própria linha de
 * `notificacoes` (coluna `payload_reenvio`, migration 0012) — assim o retry é
 * genérico, não precisa re-renderizar o template por tipo.
 */
function fakeTransport(result: Awaited<ReturnType<EmailTransport["send"]>>): EmailTransport {
  return { send: vi.fn(async () => result) };
}

function fakeSupabase(linhasFalhas: Array<Record<string, unknown>>) {
  const updates: Array<{ id: string; patch: Record<string, unknown> }> = [];
  const filtros: string[] = [];
  const query = {
    select: () => query,
    eq: () => query,
    lt: (coluna: string) => {
      filtros.push(`lt:${coluna}`);
      return query;
    },
    not: () => query,
    then: (resolve: (v: { data: unknown; error: null }) => void) =>
      resolve({ data: linhasFalhas, error: null }),
  };
  return {
    updates,
    filtros,
    from() {
      return {
        select: () => query,
        update(patch: Record<string, unknown>) {
          return {
            eq: async (_col: string, id: string) => {
              updates.push({ id, patch });
              return { error: null };
            },
          };
        },
      };
    },
  };
}

const linhaFalha = {
  id: "n1",
  destinatario_email: "alvo@exemplo.invalid",
  tentativas: 1,
  payload_reenvio: { subject: "Assunto", html: "<p>x</p>", text: "x" },
};

describe("reprocessarNotificacoesFalhas", () => {
  it("reenvia a notificação que falhou e marca 'enviada' incrementando tentativas", async () => {
    const supabase = fakeSupabase([linhaFalha]);
    const transport = fakeTransport({ ok: true, id: "resend-xyz" });

    const res = await reprocessarNotificacoesFalhas({
      supabase: supabase as never,
      transport,
      maxTentativas: 3,
    });

    expect(transport.send).toHaveBeenCalledWith({
      to: "alvo@exemplo.invalid",
      subject: "Assunto",
      html: "<p>x</p>",
      text: "x",
    });
    expect(supabase.updates[0]).toMatchObject({
      id: "n1",
      patch: { status: "enviada", resend_id: "resend-xyz", tentativas: 2 },
    });
    expect(res).toMatchObject({ processadas: 1, reenviadas: 1, aindaFalhando: 0 });
  });

  it("mantém 'falhou' e só incrementa tentativas quando o reenvio falha de novo", async () => {
    const supabase = fakeSupabase([linhaFalha]);
    const transport = fakeTransport({ ok: false, error: "rate_limit_exceeded" });

    const res = await reprocessarNotificacoesFalhas({
      supabase: supabase as never,
      transport,
      maxTentativas: 3,
    });

    expect(supabase.updates[0]).toMatchObject({
      id: "n1",
      patch: { status: "falhou", tentativas: 2, erro: "rate_limit_exceeded" },
    });
    expect(res).toMatchObject({ processadas: 1, reenviadas: 0, aindaFalhando: 1 });
  });

  it("não faz nada quando não há linhas em falhou dentro do limite de tentativas", async () => {
    const supabase = fakeSupabase([]);
    const transport = fakeTransport({ ok: true, id: "x" });

    const res = await reprocessarNotificacoesFalhas({
      supabase: supabase as never,
      transport,
      maxTentativas: 3,
    });

    expect(transport.send).not.toHaveBeenCalled();
    expect(res).toMatchObject({ processadas: 0, reenviadas: 0, aindaFalhando: 0 });
  });
});

/**
 * As 21 notificações que falharam por remetente inválido chegaram a
 * `tentativas = 3` e ficaram fora do alcance do filtro `< maxTentativas` — o
 * botão de reprocessar não as via mais, mesmo depois de a configuração ter sido
 * corrigida. `reiniciarTentativas` existe para esse caso: a falha não era da
 * mensagem, era do ambiente.
 */
describe("reprocessarNotificacoesFalhas — reinício de tentativas", () => {
  it("ignora o teto de tentativas quando reiniciarTentativas está ligado", async () => {
    const supabase = fakeSupabase([
      {
        id: "n1",
        destinatario_email: "alguem@exemplo.com",
        tentativas: 3,
        payload_reenvio: { subject: "s", html: "<p>h</p>", text: "t" },
      },
    ]);

    const resultado = await reprocessarNotificacoesFalhas({
      supabase: supabase as never,
      transport: fakeTransport({ ok: true, id: "re_1" }),
      maxTentativas: 3,
      reiniciarTentativas: true,
    });

    expect(resultado).toMatchObject({ processadas: 1, reenviadas: 1, aindaFalhando: 0 });
    expect(supabase.updates[0].patch).toMatchObject({ status: "enviada", tentativas: 1 });
  });

  it("mantém o teto de tentativas quando reiniciarTentativas não é pedido", async () => {
    const supabase = fakeSupabase([]);

    await reprocessarNotificacoesFalhas({
      supabase: supabase as never,
      transport: fakeTransport({ ok: true, id: "re_1" }),
      maxTentativas: 3,
    });

    // O filtro é o que impede reenvio infinito de uma mensagem que falha sozinha.
    expect(supabase.filtros).toContain("lt:tentativas");
  });
});
