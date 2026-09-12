import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createResendTransport } from "@/lib/notificacoes/transporte";

/**
 * O transporte precisa recusar configuração inválida ANTES de chamar a API: em
 * `sendNotification` a linha de `notificacoes` já foi gravada quando o envio
 * acontece, e a chave de idempotência impede que o mesmo aviso seja refeito do
 * zero. Um erro nomeado aqui é o que permite diagnosticar em `/configuracoes`.
 */
const envioMock = vi.fn();

vi.mock("resend", () => ({
  Resend: class {
    emails = { send: (...args: unknown[]) => envioMock(...args) };
  },
}));

beforeEach(() => envioMock.mockReset());
afterEach(() => vi.restoreAllMocks());

describe("createResendTransport", () => {
  const params = { to: "alguem@exemplo.com", subject: "s", html: "<p>h</p>", text: "t" };

  it("não chama a API quando falta a chave", async () => {
    const r = await createResendTransport("", "Comitê <a@b.com.br>").send(params);
    expect(r).toEqual({ ok: false, error: "resend_api_key_ausente" });
    expect(envioMock).not.toHaveBeenCalled();
  });

  it("não chama a API quando o remetente é inválido e explica o motivo", async () => {
    const r = await createResendTransport("re_teste", "Comitê Digital").send(params);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("remetente_sem_endereco");
    expect(envioMock).not.toHaveBeenCalled();
  });

  it("envia com o remetente normalizado, não com a string crua do ambiente", async () => {
    envioMock.mockResolvedValue({ data: { id: "id-123" }, error: null });

    const r = await createResendTransport(
      "re_teste",
      '"Comitê Digital <contato@tripfriends.com.br>"',
    ).send(params);

    expect(r).toEqual({ ok: true, id: "id-123" });
    expect(envioMock).toHaveBeenCalledWith(
      expect.objectContaining({ from: "Comitê Digital <contato@tripfriends.com.br>" }),
    );
  });

  it("repassa o erro da API como motivo da falha", async () => {
    envioMock.mockResolvedValue({
      data: null,
      error: { name: "validation_error", message: "Invalid `from` field." },
    });

    const r = await createResendTransport("re_teste", "Comitê <a@b.com.br>").send(params);
    expect(r).toEqual({ ok: false, error: "validation_error: Invalid `from` field." });
  });
});
