import { describe, expect, it } from "vitest";
import { negarCronNaoAutorizado } from "@/lib/cron/rota";

/**
 * Job `manter_banco_ativo` (evitar pausa do Supabase por inatividade — ver
 * migration 0033 e `src/lib/cron/jobs.ts`).
 *
 * Mesmo gate das outras rotas de `/api/cron/*`: "rota de cron sem
 * CRON_SECRET responde 401". Com o segredo certo, o ping deve mesmo chegar
 * ao Supabase real (é o próprio ponto do job) e devolver `ok: true`.
 */
describe("rota /api/cron/manter-banco-ativo", () => {
  it("sem CRON_SECRET responde 401 (JSON, não redirect)", async () => {
    const { POST } = await import("@/app/api/cron/manter-banco-ativo/route");
    const resposta = await POST(
      new Request("http://localhost/api/cron/manter-banco-ativo", { method: "POST" }) as never,
    );
    expect(resposta.status).toBe(401);
    expect(resposta.headers.get("content-type")).toContain("application/json");
  });

  it("com o Bearer certo, faz o ping de verdade e responde ok:true", async () => {
    const segredo = process.env.CRON_SECRET;
    expect(segredo && segredo.length).toBeGreaterThan(0);

    const req = new Request("http://localhost/api/cron/manter-banco-ativo", {
      method: "POST",
      headers: { authorization: `Bearer ${segredo}` },
    });
    expect(negarCronNaoAutorizado(req)).toBeNull();

    const { POST } = await import("@/app/api/cron/manter-banco-ativo/route");
    const resposta = await POST(req as never);
    expect(resposta.status).toBe(200);
    const corpo = await resposta.json();
    expect(corpo.ok).toBe(true);
    expect(new Date(corpo.verificadoEm).toString()).not.toBe("Invalid Date");
  });
});
