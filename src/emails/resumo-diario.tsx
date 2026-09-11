/**
 * E-mail de `resumo_diario` — Seção 6: "Todo dia útil às 8h (America/Sao_Paulo) |
 * Gestor | O que mudou em 24 h e pendências críticas." Regra 7: só números
 * agregados e link para o painel — nenhum nome, CPF ou valor.
 */
import * as React from "react";
import { Body, Container, Head, Heading, Html, Link, Preview, Text, render } from "react-email";

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
    ["Notificações com falha (pendências)", numeros.notificacoesComFalha],
  ];
  return (
    <Html lang="pt-BR">
      <Head />
      <Preview>Resumo do dia — Comitê Digital</Preview>
      <Body style={{ fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif", backgroundColor: "#F8FAF9", padding: "24px" }}>
        <Container style={{ backgroundColor: "#ffffff", padding: "28px", maxWidth: "480px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
          <Heading as="h2" style={{ fontSize: "18px", color: "#0A0F0D" }}>
            Resumo de {dataReferencia}
          </Heading>
          <Text style={{ color: "#0A0F0D" }}>Movimento das últimas 24 horas:</Text>
          {linhas.map(([rotulo, valor]) => (
            <Text key={rotulo} style={{ color: "#0A0F0D", margin: "4px 0" }}>
              {rotulo}: <strong>{valor}</strong>
            </Text>
          ))}
          <Text>
            <Link href={urlPainel} style={{ color: "#157F58", fontWeight: "600" }}>
              Abrir o painel →
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
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
