/**
 * E-mail de `documento_a_vencer` — par do `vigencia_a_vencer`.
 *
 * Aquele avisa contrato chegando ao fim; este avisa documento chegando ao
 * vencimento (NR, ASO, treinamento, credencial). Vai para a coordenação, não
 * para o titular: quem precisa agendar a renovação é quem administra.
 *
 * Regra 7: nomeia a pessoa e o tipo do documento, nunca o conteúdo dele.
 * Moldura institucional em `layout.tsx`.
 */
import * as React from "react";
import { render } from "react-email";
import { BotaoEmail, CaixaEmail, LayoutEmail, LinhaDado, TextoEmail } from "./layout";

export interface DocumentoAVencerEmailProps {
  nomePessoa: string;
  tipoDocumento: string;
  validoAte: string;
  diasRestantes: number;
  urlDocumentos: string;
}

function DocumentoAVencerEmail({
  nomePessoa,
  tipoDocumento,
  validoAte,
  diasRestantes,
  urlDocumentos,
}: DocumentoAVencerEmailProps) {
  const plural = diasRestantes === 1 ? "" : "s";

  return (
    <LayoutEmail
      previa={`Documento de ${nomePessoa} vence em ${diasRestantes} dia${plural}`}
      titulo="Documento a vencer"
    >
      <TextoEmail>
        Um documento aprovado está perto do vencimento. Depois da data abaixo ele deixa de valer
        como comprovação, e a pessoa fica irregular para novas contratações.
      </TextoEmail>

      <CaixaEmail tom="atencao" titulo="Documento a vencer">
        <LinhaDado rotulo="Pessoa" valor={<strong>{nomePessoa}</strong>} />
        <LinhaDado rotulo="Documento" valor={tipoDocumento} />
        <LinhaDado rotulo="Válido até" valor={<strong>{validoAte}</strong>} />
        <LinhaDado
          rotulo="Prazo restante"
          valor={
            <strong>
              {diasRestantes} dia{plural}
            </strong>
          }
        />
      </CaixaEmail>

      <BotaoEmail href={urlDocumentos}>Abrir a conferência de documentos</BotaoEmail>
    </LayoutEmail>
  );
}

export async function renderizarEmailDocumentoAVencer(params: DocumentoAVencerEmailProps) {
  const elemento = <DocumentoAVencerEmail {...params} />;
  const [html, text] = await Promise.all([
    render(elemento),
    render(elemento, { plainText: true }),
  ]);

  return {
    subject: `Documento de ${params.nomePessoa} vence em ${params.diasRestantes} dia${
      params.diasRestantes === 1 ? "" : "s"
    }`,
    html,
    text,
  };
}
