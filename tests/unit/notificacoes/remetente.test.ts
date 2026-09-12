import { describe, it, expect } from "vitest";
import { normalizarRemetente } from "@/lib/notificacoes/remetente";

/**
 * Regressão das 21 notificações que o Resend recusou com
 * `validation_error: Invalid \`from\` field`.
 *
 * A causa não estava no envio e sim no valor de `RESEND_FROM`: a aplicação
 * repassava a string do ambiente sem conferir se ela era um endereço parseável,
 * e a higienização anterior (`replace(/^["']|["']$/g, "")`) removia aspas soltas
 * — o que destrói um display name legítimo em vez de consertá-lo.
 *
 * As formas recusadas pela API foram confirmadas contra a API real do Resend;
 * cada caso aqui espelha uma delas.
 */
describe("normalizarRemetente", () => {
  it("aceita o formato canônico Nome <email>", () => {
    expect(normalizarRemetente("Comitê Digital <contato@tripfriends.com.br>")).toEqual({
      ok: true,
      valor: "Comitê Digital <contato@tripfriends.com.br>",
      nome: "Comitê Digital",
      email: "contato@tripfriends.com.br",
    });
  });

  it("aceita endereço puro, sem display name", () => {
    const r = normalizarRemetente("contato@tripfriends.com.br");
    expect(r).toMatchObject({ ok: true, valor: "contato@tripfriends.com.br" });
  });

  it("remove o par de aspas que envolve o valor inteiro", () => {
    const r = normalizarRemetente('"Comitê Digital <contato@tripfriends.com.br>"');
    expect(r).toMatchObject({ ok: true, valor: "Comitê Digital <contato@tripfriends.com.br>" });
  });

  it("preserva display name entre aspas em vez de deixar uma aspa órfã", () => {
    // A higienização antiga devolvia `Comitê Digital" <contato@…>` — o Resend
    // aceita, mas o destinatário vê a aspa solta no remetente.
    const r = normalizarRemetente('"Comitê Digital" <contato@tripfriends.com.br>');
    expect(r).toMatchObject({ ok: true, nome: "Comitê Digital" });
  });

  it("fecha o < que ficou sem o > correspondente", () => {
    // Forma que o Resend recusa com "needs to follow the … format".
    const r = normalizarRemetente("Comitê Digital <contato@tripfriends.com.br");
    expect(r).toMatchObject({ ok: true, valor: "Comitê Digital <contato@tripfriends.com.br>" });
  });

  it("descarta o > sobrando no fim", () => {
    const r = normalizarRemetente("Comitê Digital <contato@tripfriends.com.br>>");
    expect(r).toMatchObject({ ok: true, valor: "Comitê Digital <contato@tripfriends.com.br>" });
  });

  it("reduz endereço só entre colchetes angulares ao endereço puro", () => {
    // `<contato@…>` sozinho é recusado pelo Resend.
    const r = normalizarRemetente("<contato@tripfriends.com.br>");
    expect(r).toMatchObject({ ok: true, valor: "contato@tripfriends.com.br" });
  });

  it("normaliza espaços e quebras de linha coladas pelo painel de deploy", () => {
    const r = normalizarRemetente("  Comitê  Digital   <contato@tripfriends.com.br>\n");
    expect(r).toMatchObject({ ok: true, valor: "Comitê Digital <contato@tripfriends.com.br>" });
  });

  it("cita o display name quando ele traz caracteres especiais do RFC 5322", () => {
    const r = normalizarRemetente("Comitê Digital, Contratos <contato@tripfriends.com.br>");
    expect(r).toMatchObject({
      ok: true,
      valor: '"Comitê Digital, Contratos" <contato@tripfriends.com.br>',
    });
  });

  it("recusa valor vazio com motivo próprio", () => {
    expect(normalizarRemetente("   ")).toMatchObject({ ok: false, motivo: "remetente_ausente" });
    expect(normalizarRemetente("")).toMatchObject({ ok: false, motivo: "remetente_ausente" });
  });

  it("recusa nome sem endereço nenhum", () => {
    const r = normalizarRemetente("Comitê Digital");
    expect(r).toMatchObject({ ok: false, motivo: "remetente_sem_endereco" });
  });

  it("recusa endereço com acento — o Resend exige ASCII na parte do e-mail", () => {
    const r = normalizarRemetente("Comitê Digital <contató@tripfriends.com.br>");
    expect(r).toMatchObject({ ok: false, motivo: "remetente_endereco_nao_ascii" });
  });

  it("recusa endereço malformado", () => {
    expect(normalizarRemetente("Comitê Digital <contato@>")).toMatchObject({
      ok: false,
      motivo: "remetente_endereco_invalido",
    });
    expect(normalizarRemetente("Comitê Digital <contato tripfriends.com.br>")).toMatchObject({
      ok: false,
      motivo: "remetente_endereco_invalido",
    });
  });

  it("descreve o problema em português na mensagem do erro", () => {
    const r = normalizarRemetente("Comitê Digital");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.mensagem).toMatch(/RESEND_FROM/);
  });
});
