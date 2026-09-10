/**
 * E-mail de `distrato_enviado` — Notificação de rescisão/distrato contratual do integrante.
 * Regra 7: sem CPF/dados bancários no assunto ou corpo sensível — informa formalização,
 * período trabalhado apurado e valor proporcional nos termos da legislação eleitoral.
 */
import * as React from "react";
import { Body, Container, Head, Heading, Html, Link, Preview, Text, render } from "react-email";

export interface DistratoEnviadoEmailProps {
  primeiroNome: string;
  objeto: string;
  dataDistrato: string;
  periodoTrabalhado: string;
  valorProporcional: string;
  motivo?: string;
  urlContato?: string;
}

export function DistratoEnviadoEmail({
  primeiroNome,
  objeto,
  dataDistrato,
  periodoTrabalhado,
  valorProporcional,
  motivo,
  urlContato,
}: DistratoEnviadoEmailProps) {
  return (
    <Html lang="pt-BR">
      <Head />
      <Preview>Formalização do Termo de Distrato Contratual</Preview>
      <Body
        style={{
          fontFamily:
            "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
          backgroundColor: "#F8FAF9",
          padding: "24px",
        }}
      >
        <Container
          style={{
            backgroundColor: "#ffffff",
            padding: "28px",
            maxWidth: "520px",
            borderRadius: "8px",
            border: "1px solid #E2E8F0",
          }}
        >
          <Heading as="h2" style={{ fontSize: "18px", color: "#0A0F0D", marginTop: 0 }}>
            Olá, {primeiroNome}
          </Heading>
          <Text style={{ color: "#0A0F0D", lineHeight: "1.5" }}>
            Informamos que a formalização do <strong>Termo de Distrato / Rescisão</strong> relativo ao contrato de prestação de serviços para <strong>{objeto}</strong> foi registrada no sistema em <strong>{dataDistrato}</strong>.
          </Text>

          <div
            style={{
              backgroundColor: "#F8FAF9",
              border: "1px solid #E2E8F0",
              borderRadius: "6px",
              padding: "16px",
              margin: "20px 0",
            }}
          >
            <Text
              style={{
                fontSize: "13px",
                fontWeight: "bold",
                color: "#1FA871",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                margin: "0 0 8px 0",
              }}
            >
              Resumo da Rescisão
            </Text>
            <Text style={{ fontSize: "14px", color: "#0A0F0D", margin: "4px 0" }}>
              <strong>Período apurado:</strong> {periodoTrabalhado}
            </Text>
            <Text style={{ fontSize: "14px", color: "#0A0F0D", margin: "4px 0" }}>
              <strong>Valor proporcional calculado:</strong> {valorProporcional}
            </Text>
            {motivo && (
              <Text style={{ fontSize: "13px", color: "#52605B", margin: "6px 0 0 0" }}>
                <strong>Motivo informado:</strong> {motivo}
              </Text>
            )}
          </div>

          <Text style={{ color: "#52605B", fontSize: "13px", lineHeight: "1.5" }}>
            O termo formal de rescisão foi anexado e registrado pela coordenação da campanha em conformidade com as exigências de prestação de contas eleitorais. Caso necessite de uma cópia assinada ou esclarecimentos adicionais, entre em contato com a equipe administrativa.
          </Text>

          {urlContato && (
            <Text style={{ marginTop: "24px", borderTop: "1px solid #E2E8F0", paddingTop: "16px" }}>
              <Link href={urlContato} style={{ color: "#157F58", fontSize: "13px" }}>
                Acessar portal do Comitê Digital
              </Link>
            </Text>
          )}
        </Container>
      </Body>
    </Html>
  );
}

export async function renderizarEmailDistratoEnviado(params: DistratoEnviadoEmailProps) {
  const elemento = <DistratoEnviadoEmail {...params} />;
  const [html, text] = await Promise.all([
    render(elemento),
    render(elemento, { plainText: true }),
  ]);

  return {
    subject: "Formalização do Termo de Distrato Contratual",
    html,
    text,
  };
}
