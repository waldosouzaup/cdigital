/**
 * E-mail de `vigencia_a_vencer` — Seção 6: "7 e 3 dias do término | Gestor e
 * coord. do comitê | Quantidade e link para a lista." Regra 7: sem valor de
 * contrato, sem dado da pessoa — só objeto, prazo e link para a lista no painel.
 * Moldura institucional em `layout.tsx`.
 */
import * as React from "react";
import { render } from "react-email";
import { BotaoEmail, CaixaEmail, LayoutEmail, LinhaDado, TextoEmail } from "./layout";

interface VigenciaAVencerEmailProps {
  objeto: string;
  diasRestantes: number;
  urlLista: string;
}

function VigenciaAVencerEmail({ objeto, diasRestantes, urlLista }: VigenciaAVencerEmailProps) {
  const plural = diasRestantes === 1 ? "" : "s";
  return (
    <LayoutEmail
      previa={`Contrato a vencer em ${diasRestantes} dia${plural}`}
      titulo="Vigência a vencer"
    >
      <TextoEmail>
        Um contrato da campanha está perto do fim da vigência. Verifique se há renovação,
        encerramento ou distrato a providenciar.
      </TextoEmail>

      <CaixaEmail tom="atencao" titulo="Contrato a vencer">
        <LinhaDado rotulo="Objeto" valor={<strong>{objeto}</strong>} />
        <LinhaDado
          rotulo="Prazo restante"
          valor={
            <strong>
              {diasRestantes} dia{plural}
            </strong>
          }
        />
      </CaixaEmail>

      <BotaoEmail href={urlLista}>Abrir a lista de contratos</BotaoEmail>
    </LayoutEmail>
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
