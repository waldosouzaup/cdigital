/**
 * E-mail de `resumo_diario` — Seção 6: "Todo dia útil às 8h (America/Sao_Paulo) |
 * Gestor | O que mudou em 24 h e pendências críticas." Regra 7: só números
 * agregados e link para o painel — nenhum nome, CPF ou valor.
 */
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
      <Body style={{ fontFamily: "Arial, sans-serif", backgroundColor: "#eceeeb", padding: "24px" }}>
        <Container style={{ backgroundColor: "#ffffff", padding: "24px", maxWidth: "480px" }}>
          <Heading as="h2" style={{ fontSize: "18px", color: "#1b2430" }}>
            Resumo de {dataReferencia}
          </Heading>
          <Text style={{ color: "#1b2430" }}>Movimento das últimas 24 horas:</Text>
          {linhas.map(([rotulo, valor]) => (
            <Text key={rotulo} style={{ color: "#1b2430", margin: "4px 0" }}>
              {rotulo}: <strong>{valor}</strong>
            </Text>
          ))}
          <Text>
            <Link href={urlPainel} style={{ color: "#b8752e" }}>
              Abrir o painel
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
