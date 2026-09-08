/**
 * E-mail de `pessoa_apta` — Seção 6: "Documentação completa e aprovada | Coordenador
 * responsável | Pessoa liberada para contrato." Vai para o coordenador, não para o
 * contratado — por isso o conteúdo pode nomear a pessoa (não é dado sensível dela
 * mesma sendo enviado a ela).
 */
import { Body, Container, Head, Heading, Html, Link, Preview, Text, render } from "react-email";

interface PessoaAptaEmailProps {
  nomePessoa: string;
  urlPainel: string;
}

function PessoaAptaEmail({ nomePessoa, urlPainel }: PessoaAptaEmailProps) {
  return (
    <Html lang="pt-BR">
      <Head />
      <Preview>{`${nomePessoa} está com a documentação completa`}</Preview>
      <Body style={{ fontFamily: "Arial, sans-serif", backgroundColor: "#eceeeb", padding: "24px" }}>
        <Container style={{ backgroundColor: "#ffffff", padding: "24px", maxWidth: "480px" }}>
          <Heading as="h2" style={{ fontSize: "18px", color: "#1b2430" }}>
            Documentação aprovada
          </Heading>
          <Text style={{ color: "#1b2430" }}>
            <strong>{nomePessoa}</strong> teve toda a documentação conferida e aprovada. Já está
            liberado(a) para emissão de contrato.
          </Text>
          <Text>
            <Link href={urlPainel} style={{ color: "#b8752e" }}>
              Ver no painel
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export async function renderizarEmailPessoaApta(params: PessoaAptaEmailProps) {
  const elemento = <PessoaAptaEmail {...params} />;
  const [html, text] = await Promise.all([
    render(elemento),
    render(elemento, { plainText: true }),
  ]);

  return { subject: `${params.nomePessoa} está com a documentação completa`, html, text };
}
