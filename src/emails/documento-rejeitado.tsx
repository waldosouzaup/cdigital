/**
 * E-mail de `documento_rejeitado` — Fase 2, item 3 / Seção 6: "motivo em linguagem
 * simples e link para reenviar". Mesmo cuidado do link_coleta: nada sensível no
 * corpo (Regra 7).
 */
import { Body, Container, Head, Heading, Html, Link, Preview, Text, render } from "react-email";

interface DocumentoRejeitadoEmailProps {
  primeiroNome: string;
  motivo: string;
  urlReenvio: string;
}

function DocumentoRejeitadoEmail({ primeiroNome, motivo, urlReenvio }: DocumentoRejeitadoEmailProps) {
  return (
    <Html lang="pt-BR">
      <Head />
      <Preview>Não foi possível aceitar o documento enviado — tente novamente</Preview>
      <Body style={{ fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif", backgroundColor: "#F8FAF9", padding: "24px" }}>
        <Container style={{ backgroundColor: "#ffffff", padding: "28px", maxWidth: "480px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
          <Heading as="h2" style={{ fontSize: "18px", color: "#0A0F0D" }}>
            Olá, {primeiroNome}
          </Heading>
          <Text style={{ color: "#0A0F0D" }}>
            O documento que você enviou não pôde ser aceito. {motivo}
          </Text>
          <Text>
            <Link href={urlReenvio} style={{ color: "#157F58", fontWeight: "600" }}>
              Clique aqui para enviar novamente →
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export async function renderizarEmailDocumentoRejeitado(params: DocumentoRejeitadoEmailProps) {
  const elemento = <DocumentoRejeitadoEmail {...params} />;
  const [html, text] = await Promise.all([
    render(elemento),
    render(elemento, { plainText: true }),
  ]);

  return { subject: "Não foi possível aceitar o documento enviado", html, text };
}
