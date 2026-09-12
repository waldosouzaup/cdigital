import { describe, it, expect } from "vitest";
import { CORES } from "@/emails/layout";
import { renderizarEmailCadastroRecebido } from "@/emails/cadastro-recebido";
import { renderizarEmailContratoAssinado } from "@/emails/contrato-assinado";
import { renderizarEmailContratoEnviado } from "@/emails/contrato-enviado";
import { renderizarEmailConviteUsuario } from "@/emails/convite-usuario";
import { renderizarEmailDistratoEnviado } from "@/emails/distrato-enviado";
import { renderizarEmailDocumentoRejeitado } from "@/emails/documento-rejeitado";
import { renderizarEmailLembreteAssinatura } from "@/emails/lembrete-assinatura";
import { renderizarEmailLinkColeta } from "@/emails/link-coleta";
import { renderizarEmailPessoaApta } from "@/emails/pessoa-apta";
import { renderizarEmailResumoDiario } from "@/emails/resumo-diario";
import { renderizarEmailVigenciaAVencer } from "@/emails/vigencia-a-vencer";

/**
 * Os onze avisos que saem para pessoa de fora do sistema precisam parecer o
 * mesmo remetente. Antes metade era texto cru sem nenhuma marca e a outra metade
 * repetia cabeçalho e cores digitados à mão, já divergentes entre si.
 *
 * Este teste trava o acordo: toda notificação passa pela casca de `layout.tsx`.
 */
const TEMPLATES: Array<{ tipo: string; render: () => Promise<{ subject: string; html: string; text: string }> }> = [
  {
    tipo: "cadastro_recebido",
    render: () =>
      renderizarEmailCadastroRecebido({
        primeiroNome: "Maria",
        organizacaoNome: "Comitê Central",
        protocolo: "CD-2026-0001",
        dataEnvio: "10/09/2026",
        identidadeEnviada: true,
        enderecoEnviado: false,
      }),
  },
  {
    tipo: "contrato_assinado",
    render: () =>
      renderizarEmailContratoAssinado({
        primeiroNome: "Maria",
        objeto: "Militância",
        dataAssinatura: "10/09/2026",
        urlContratoAssinado: "https://exemplo.com/c",
        urlDownloadPdf: "https://exemplo.com/p.pdf",
        urlContato: "https://exemplo.com",
      }),
  },
  {
    tipo: "contrato_enviado",
    render: () =>
      renderizarEmailContratoEnviado({
        primeiroNome: "Maria",
        objeto: "Militância",
        urlAssinatura: "https://exemplo.com/a",
        urlContato: "https://exemplo.com",
      }),
  },
  {
    tipo: "convite_usuario",
    render: () =>
      renderizarEmailConviteUsuario({
        nome: "Maria",
        email: "maria@exemplo.com",
        papel: "gestor",
        senhaTemporaria: "senha-temp",
        urlLogin: "https://exemplo.com/login",
      }),
  },
  {
    tipo: "distrato_enviado",
    render: () =>
      renderizarEmailDistratoEnviado({
        primeiroNome: "Maria",
        objeto: "Militância",
        dataDistrato: "12/08/2026",
        periodoTrabalhado: "01/08 a 12/08 (12/31 dias)",
        valorProporcional: "R$ 580,65",
        motivo: "acordo entre as partes",
        urlContato: "https://exemplo.com",
      }),
  },
  {
    tipo: "documento_rejeitado",
    render: () =>
      renderizarEmailDocumentoRejeitado({
        primeiroNome: "Maria",
        motivo: "A foto ficou desfocada.",
        urlReenvio: "https://exemplo.com/r",
      }),
  },
  {
    tipo: "lembrete_assinatura",
    render: () =>
      renderizarEmailLembreteAssinatura({
        primeiroNome: "Maria",
        objeto: "Militância",
        urlContato: "https://exemplo.com",
      }),
  },
  {
    tipo: "link_coleta",
    render: () =>
      renderizarEmailLinkColeta({
        primeiroNome: "Maria",
        url: "https://exemplo.com/coleta/abc",
        prazoDias: 7,
      }),
  },
  {
    tipo: "pessoa_apta",
    render: () =>
      renderizarEmailPessoaApta({ nomePessoa: "Maria Souza", urlPainel: "https://exemplo.com/p" }),
  },
  {
    tipo: "resumo_diario",
    render: () =>
      renderizarEmailResumoDiario({
        dataReferencia: "10/09/2026",
        numeros: {
          pessoasNovas: 3,
          contratosEmitidos: 2,
          contratosAssinados: 1,
          transicoes: 4,
          notificacoesComFalha: 0,
        },
        urlPainel: "https://exemplo.com/p",
      }),
  },
  {
    tipo: "vigencia_a_vencer",
    render: () =>
      renderizarEmailVigenciaAVencer({
        objeto: "Militância",
        diasRestantes: 7,
        urlLista: "https://exemplo.com/l",
      }),
  },
];

describe.each(TEMPLATES)("identidade visual — $tipo", ({ render }) => {
  it("carrega a marca Comitê Digital no cabeçalho", async () => {
    const { html } = await render();
    expect(html).toContain("comitê");
    expect(html).toContain("digital");
    // Ladrilho `cd` da marca oficial.
    expect(html).toContain(CORES.emblema);
  });

  it("usa o verde institucional", async () => {
    const { html } = await render();
    expect(html.toUpperCase()).toContain(CORES.primaria.toUpperCase());
  });

  it("fecha com o rodapé institucional padronizado", async () => {
    const { html } = await render();
    expect(html).toContain("Infraestrutura");
    expect(html).toContain("não responda");
  });

  it("entrega assunto e versão em texto puro não vazios", async () => {
    const { subject, text } = await render();
    expect(subject.trim().length).toBeGreaterThan(0);
    expect(text.trim().length).toBeGreaterThan(0);
  });

  it("não reintroduz container próprio com cor cravada fora do layout", async () => {
    const { html } = await render();
    // #F8FAF9 como cor de fundo do <body> era a marca dos templates soltos;
    // no layout novo o fundo é CORES.fundo e o #F8FAF9 só aparece em caixas.
    expect(html).not.toMatch(/<body[^>]*background-color:\s*#F8FAF9/i);
  });
});
