/**
 * E-mail de `resumo_diario` — Seção 6: "Todo dia útil às 8h (America/Sao_Paulo) |
 * Gestor | O que mudou em 24 h e pendências críticas." Regra 7: só números
 * agregados e link para o painel — nenhum nome, CPF ou valor.
 * Moldura institucional em `layout.tsx`.
 */
import * as React from "react";
import { render } from "react-email";
import { BotaoEmail, CORES, CaixaEmail, LayoutEmail, LinhaDado, TextoEmail } from "./layout";

export interface ResumoDiarioNumeros {
  pessoasNovas: number;
  contratosEmitidos: number;
  contratosAssinados: number;
  transicoes: number;
  notificacoesComFalha: number;
}

interface ResumoDiarioEmailProps {
  dataReferencia: string;
  numeros: ResumoDiarioNumeros;
  urlPainel: string;
}

function ResumoDiarioEmail({ dataReferencia, numeros, urlPainel }: ResumoDiarioEmailProps) {
  const linhas: [string, number][] = [
    ["Novas pessoas cadastradas", numeros.pessoasNovas],
    ["Contratos emitidos", numeros.contratosEmitidos],
    ["Contratos assinados", numeros.contratosAssinados],
    ["Transições de contrato", numeros.transicoes],
  ];

  return (
    <LayoutEmail
      previa={`Resumo do dia — ${dataReferencia}`}
      titulo={`Resumo de ${dataReferencia}`}
      urlPortal={urlPainel}
      rotuloPortal="Abrir o painel do Comitê Digital"
    >
      <TextoEmail>Movimento das últimas 24 horas na operação da campanha.</TextoEmail>

      <CaixaEmail titulo="Movimento do dia">
        {linhas.map(([rotulo, valor]) => (
          <LinhaDado key={rotulo} rotulo={rotulo} valor={<strong>{valor}</strong>} />
        ))}
      </CaixaEmail>

      {/* Pendência sai da lista neutra e ganha destaque próprio: é a única
          linha do resumo que pede ação imediata do gestor. */}
      <CaixaEmail
        tom={numeros.notificacoesComFalha > 0 ? "critico" : "positivo"}
        titulo="Notificações"
      >
        <TextoEmail style={{ margin: 0, fontSize: "14px" }}>
          {numeros.notificacoesComFalha > 0 ? (
            <>
              <strong>{numeros.notificacoesComFalha}</strong> notificação(ões) com falha de envio
              aguardando reprocessamento em{" "}
              <span style={{ color: CORES.erroTinta }}>Configurações › Comunicações</span>.
            </>
          ) : (
            <>Nenhuma notificação com falha de envio. Fila limpa.</>
          )}
        </TextoEmail>
      </CaixaEmail>

      <BotaoEmail href={urlPainel}>Abrir o painel</BotaoEmail>
    </LayoutEmail>
  );
}

export async function renderizarEmailResumoDiario(params: ResumoDiarioEmailProps) {
  const elemento = <ResumoDiarioEmail {...params} />;
  const [html, text] = await Promise.all([
    render(elemento),
    render(elemento, { plainText: true }),
  ]);
  return { subject: `Resumo do dia — ${params.dataReferencia}`, html, text };
}
