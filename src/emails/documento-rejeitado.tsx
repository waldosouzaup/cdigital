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
      <Body style={{ fontFamily: "Arial, sans-serif", backgroundColor: "#eceeeb", padding: "24px" }}>
        <Container style={{ backgroundColor: "#ffffff", padding: "24px", maxWidth: "480px" }}>
          <Heading as="h2" style={{ fontSize: "18px", color: "#1b2430" }}>
            Olá, {primeiroNome}
          </Heading>
          <Text style={{ color: "#1b2430" }}>
            O documento que você enviou não pôde ser aceito. {motivo}
          </Text>
          <Text>
            <Link href={urlReenvio} style={{ color: "#b8752e" }}>
              Clique aqui para enviar novamente
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
