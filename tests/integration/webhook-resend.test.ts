import { describe, it, expect, beforeAll } from "vitest";
import { NextRequest } from "next/server";

// Seção 12 (Integração): "Webhook do Resend com assinatura inválida é rejeitado".
// Não precisa de banco real: a verificação de assinatura falha antes de qualquer
// leitura em `notificacoes`, então o 401 é alcançável isoladamente.
describe("POST /api/webhooks/resend — assinatura inválida", () => {
  beforeAll(() => {
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.RESEND_WEBHOOK_SECRET = "whsec_test_secret";
  });

  it("responde 401 quando a assinatura não bate com o segredo", async () => {
    const { POST } = await import("@/app/api/webhooks/resend/route");

    const request = new NextRequest("http://localhost/api/webhooks/resend", {
      method: "POST",
      headers: {
        "webhook-id": "msg_forjado",
        "webhook-timestamp": String(Math.floor(Date.now() / 1000)),
        "webhook-signature": "v1,assinatura-forjada-invalida",
      },
      body: JSON.stringify({ type: "email.delivered", data: { id: "re_123" } }),
    });

    const response = await POST(request);

    expect(response.status).toBe(401);
  });

  it("responde 401 quando não há nenhum header de assinatura", async () => {
    const { POST } = await import("@/app/api/webhooks/resend/route");

    const request = new NextRequest("http://localhost/api/webhooks/resend", {
      method: "POST",
      body: JSON.stringify({ type: "email.delivered", data: { id: "re_123" } }),
    });

    const response = await POST(request);

    expect(response.status).toBe(401);
  });
});
