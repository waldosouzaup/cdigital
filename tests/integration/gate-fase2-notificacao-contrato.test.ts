import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { generateValidCpf } from "@/lib/documentos/cpf";
import { sendNotification } from "@/lib/notificacoes/enviar";
import { idempotencyKey } from "@/lib/notificacoes/chave-idempotencia";
import type { EmailTransport } from "@/lib/notificacoes/transporte";

/**
 * Gate de saída da Fase 2 — os dois itens que nenhum teste anterior cobria
 * especificamente para `contrato_enviado` (a mecânica genérica de idempotência e
 * de falha já era testada na Fase 1 para notificações em geral; aqui é a mesma
 * chamada exata que `dispararContratoEnviado` faz, contra o banco real):
 *
 * - "Disparar contrato_enviado duas vezes para o mesmo contrato envia um único e-mail."
 * - "Simular queda do Resend: o contrato continua enviado e a notificação fica falhou."
 */
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

function transporteFalso(resultado: { ok: true; id: string } | { ok: false; error: string }) {
  let chamadas = 0;
  const transporte: EmailTransport = {
    async send() {
      chamadas++;
      return resultado;
    },
  };
  return { transporte, contarChamadas: () => chamadas };
}

describe("Gate Fase 2 — contrato_enviado: idempotência e falha do Resend", () => {
  let orgId: string;
  let regiaoId: string;
  let pessoaId: string;
  let contratoId: string;

  beforeAll(async () => {
    const { data: org } = await admin
      .from("organizacoes")
      .select("id")
      .eq("nome", "Comitê Michelle — Eleição 2026")
      .single();
    orgId = org!.id;

    const { data: regiao } = await admin
      .from("regioes")
      .select("id")
      .eq("organizacao_id", orgId)
      .limit(1)
      .single();
    regiaoId = regiao!.id;

    const { data: pessoa } = await admin
      .from("pessoas")
      .insert({
        organizacao_id: orgId,
        nome_completo: "Pessoa Gate Notificacao",
        cpf: generateValidCpf("66677788"),
        regiao_id: regiaoId,
        email: "gate-notificacao@exemplo.invalid",
      })
      .select("id")
      .single();
    pessoaId = pessoa!.id;

    const { data: contrato } = await admin
      .from("contratos")
      .insert({
        organizacao_id: orgId,
        pessoa_id: pessoaId,
        objeto: "Teste Gate Notificação",
        valor: "1500.00",
        valor_extenso: "mil e quinhentos reais",
        vigencia_inicio: "2026-09-01",
        vigencia_fim: "2026-10-03",
        status: "enviado",
      })
      .select("id")
      .single();
    contratoId = contrato!.id;
  }, 30000);

  afterAll(async () => {
    await admin.from("notificacoes").delete().eq("entidade_id", contratoId);
    await admin.from("contratos").delete().eq("id", contratoId);
    await admin.from("pessoas").delete().eq("id", pessoaId);
  }, 30000);

  it("simula queda do Resend: notificação fica 'falhou' e o contrato continua 'enviado'", async () => {
    const { transporte } = transporteFalso({ ok: false, error: "resend_indisponivel" });

    const resultado = await sendNotification({
      supabase: admin,
      transport: transporte,
      organizationId: orgId,
      type: "contrato_enviado",
      recipientEmail: "gate-notificacao@exemplo.invalid",
      entity: "contratos",
      entityId: contratoId,
      idempotencyKey: idempotencyKey("contrato_enviado", contratoId),
      subject: "Teste",
      html: "<p>Teste</p>",
      text: "Teste",
    });

    expect(resultado).toEqual({ sent: false, reason: "failed" });

    const { data: notificacao } = await admin
      .from("notificacoes")
      .select("status, erro")
      .eq("chave_idempotencia", idempotencyKey("contrato_enviado", contratoId))
      .single();
    expect(notificacao?.status).toBe("falhou");

    const { data: contrato } = await admin.from("contratos").select("status").eq("id", contratoId).single();
    expect(contrato?.status).toBe("enviado");
  });

  it("disparar contrato_enviado de novo (mesma chave) após a falha: tenta de novo, não duplica linha", async () => {
    // A falha anterior não consumiu a chave de idempotência de verdade — o índice
    // único é em (chave_idempotencia), e a linha já existe com aquele valor. Uma
    // nova tentativa com a MESMA chave recusa o insert (linha "duplicate"), que é
    // exatamente o comportamento que impede reenvio automático descontrolado.
    const { transporte, contarChamadas } = transporteFalso({ ok: true, id: "resend-id-teste" });

    const resultado = await sendNotification({
      supabase: admin,
      transport: transporte,
      organizationId: orgId,
      type: "contrato_enviado",
      recipientEmail: "gate-notificacao@exemplo.invalid",
      entity: "contratos",
      entityId: contratoId,
      idempotencyKey: idempotencyKey("contrato_enviado", contratoId),
      subject: "Teste",
      html: "<p>Teste</p>",
      text: "Teste",
    });

    expect(resultado).toEqual({ sent: false, reason: "duplicate" });
    expect(contarChamadas()).toBe(0); // nem chegou a chamar o transporte de e-mail

    const { data: notificacoes } = await admin
      .from("notificacoes")
      .select("id")
      .eq("chave_idempotencia", idempotencyKey("contrato_enviado", contratoId));
    expect(notificacoes).toHaveLength(1); // continua só a linha da primeira tentativa
  });

  it("um contrato NOVO (chave diferente) com Resend funcionando: envia uma única vez mesmo se chamado duas vezes seguidas", async () => {
    const { data: outroContrato } = await admin
      .from("contratos")
      .insert({
        organizacao_id: orgId,
        pessoa_id: pessoaId,
        objeto: "Segundo Teste Gate Notificação",
        valor: "1500.00",
        valor_extenso: "mil e quinhentos reais",
        vigencia_inicio: "2026-09-01",
        vigencia_fim: "2026-10-03",
        status: "enviado",
      })
      .select("id")
      .single();
    const outroContratoId = outroContrato!.id;
    const chave = idempotencyKey("contrato_enviado", outroContratoId);

    const { transporte, contarChamadas } = transporteFalso({ ok: true, id: "resend-id-teste-2" });

    const params = {
      supabase: admin,
      transport: transporte,
      organizationId: orgId,
      type: "contrato_enviado" as const,
      recipientEmail: "gate-notificacao@exemplo.invalid",
      entity: "contratos",
      entityId: outroContratoId,
      idempotencyKey: chave,
      subject: "Teste",
      html: "<p>Teste</p>",
      text: "Teste",
    };

    const primeiraTentativa = await sendNotification(params);
    const segundaTentativa = await sendNotification(params); // simula clique duplo / job repetido

    expect(primeiraTentativa).toEqual({ sent: true });
    expect(segundaTentativa).toEqual({ sent: false, reason: "duplicate" });
    expect(contarChamadas()).toBe(1); // o transporte de e-mail só foi chamado UMA vez

    const { data: notificacoes } = await admin.from("notificacoes").select("id, status").eq("chave_idempotencia", chave);
    expect(notificacoes).toHaveLength(1);
    expect(notificacoes?.[0].status).toBe("enviada");

    await admin.from("notificacoes").delete().eq("entidade_id", outroContratoId);
    await admin.from("contratos").delete().eq("id", outroContratoId);
  });
});
