import { describe, it, expect } from "vitest";
import { mapWebhookEventToStatus } from "@/lib/notificacoes/webhook";

// Tipos confirmados contra o .d.ts do pacote `resend` realmente instalado (não a
// doc do Context 7, que veio da branch canary — ver CONSULTAS.md): email.sent,
// email.delivered, email.bounced, email.complained.
describe("mapWebhookEventToStatus", () => {
  it("mapeia email.sent para enviada", () => {
    expect(mapWebhookEventToStatus("email.sent")).toBe("enviada");
  });

  it("mapeia email.delivered para entregue", () => {
    expect(mapWebhookEventToStatus("email.delivered")).toBe("entregue");
  });

  it("mapeia email.bounced para bounce", () => {
    expect(mapWebhookEventToStatus("email.bounced")).toBe("bounce");
  });

  it("mapeia email.complained para reclamada", () => {
    expect(mapWebhookEventToStatus("email.complained")).toBe("reclamada");
  });

  it("retorna null para eventos que não mudam o status rastreado (ex.: email.opened)", () => {
    expect(mapWebhookEventToStatus("email.opened")).toBeNull();
    expect(mapWebhookEventToStatus("email.clicked")).toBeNull();
    expect(mapWebhookEventToStatus("contact.created")).toBeNull();
  });
});
