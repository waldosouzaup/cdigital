/**
 * E-mail de `vigencia_a_vencer` — Seção 6: "7 e 3 dias do término | Gestor e
 * coord. do comitê | Quantidade e link para a lista." Regra 7: sem valor de
 * contrato, sem dado da pessoa — só objeto, prazo e link para a lista no painel.
 */
import { Body, Container, Head, Heading, Html, Link, Preview, Text, render } from "react-email";

interface VigenciaAVencerEmailProps {
  objeto: string;
  diasRestantes: number;
  urlLista: string;
}

function VigenciaAVencerEmail({ objeto, diasRestantes, urlLista }: VigenciaAVencerEmailProps) {
  return (
    <Html lang="pt-BR">
      <Head />
      <Preview>Contrato a vencer em {String(diasRestantes)} dias</Preview>
      <Body style={{ fontFamily: "Arial, sans-serif", backgroundColor: "#eceeeb", padding: "24px" }}>
        <Container style={{ backgroundColor: "#ffffff", padding: "24px", maxWidth: "480px" }}>
          <Heading as="h2" style={{ fontSize: "18px", color: "#1b2430" }}>
            Vigência a vencer
          </Heading>
          <Text style={{ color: "#1b2430" }}>
            O contrato de <strong>{objeto}</strong> termina em <strong>{diasRestantes} dias</strong>.
            Verifique se há renovação, encerramento ou distrato a providenciar.
          </Text>
          <Text>
            <Link href={urlLista} style={{ color: "#b8752e" }}>
              Abrir a lista de contratos
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export async function renderizarEmailVigenciaAVencer(params: VigenciaAVencerEmailProps) {
  const elemento = <VigenciaAVencerEmail {...params} />;
  const [html, text] = await Promise.all([
    render(elemento),
    render(elemento, { plainText: true }),
  ]);
  return {
    subject: `Contrato a vencer em ${params.diasRestantes} dias`,
    html,
    text,
  };
}
