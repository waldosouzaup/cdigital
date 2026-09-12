/**
 * E-mail de `pessoa_apta` — Seção 6: "Documentação completa e aprovada | Coordenador
 * responsável | Pessoa liberada para contrato." Vai para o coordenador, não para o
 * contratado — por isso o conteúdo pode nomear a pessoa (não é dado sensível dela
 * mesma sendo enviado a ela). Moldura institucional em `layout.tsx`.
 */
import * as React from "react";
import { render } from "react-email";
import { BotaoEmail, CaixaEmail, LayoutEmail, LinhaDado, TextoEmail } from "./layout";

interface PessoaAptaEmailProps {
  nomePessoa: string;
  urlPainel: string;
}

function PessoaAptaEmail({ nomePessoa, urlPainel }: PessoaAptaEmailProps) {
  return (
    <LayoutEmail
      previa={`${nomePessoa} está com a documentação completa`}
      titulo="Documentação aprovada"
      urlPortal={urlPainel}
      rotuloPortal="Abrir o painel de pessoas"
    >
      <TextoEmail>
        A conferência foi concluída: a pessoa abaixo está liberada para emissão de contrato.
      </TextoEmail>

      <CaixaEmail tom="positivo" titulo="Pessoa liberada">
        <LinhaDado rotulo="Nome" valor={<strong>{nomePessoa}</strong>} />
        <LinhaDado rotulo="Situação" valor="Documentação completa e aprovada" />
      </CaixaEmail>

      <BotaoEmail href={urlPainel}>Ver no painel</BotaoEmail>
    </LayoutEmail>
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
