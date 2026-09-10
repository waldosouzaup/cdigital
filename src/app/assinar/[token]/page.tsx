import { Marca } from "@/components/marca";
import { Alerta } from "@/components/alerta";
import { createClient } from "@/lib/supabase/server";
import { AssinarCliente, type DadosContratoAssinatura } from "./assinar-cliente";

export const metadata = {
  robots: { index: false, follow: false },
  referrer: "no-referrer" as const,
};

interface LinhaValidarAssinatura {
  contrato_id: string;
  pessoa_id: string;
  nome_completo: string;
  primeiro_nome: string;
  cpf: string;
  objeto: string;
  valor: number | string;
  valor_extenso: string;
  vigencia_inicio: string;
  vigencia_fim: string;
  status: "enviado" | "assinado";
  organizacao_nome: string;
  caminho_pdf: string | null;
  assinado_em: string | null;
}

export default async function AssinaturaPublicaPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();

  const { data: linha, error } = await supabase
    .rpc("validar_link_assinatura", { p_token: token })
    .maybeSingle<LinhaValidarAssinatura>();

  if (error || !linha) {
    return (
      <div className="min-h-screen bg-canvas text-ink flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-md space-y-6 text-center">
          <Marca className="justify-center" />
          <Alerta tom="critico" titulo="Link de assinatura inválido ou não encontrado">
            Este link de contrato não é válido, expirou ou o contrato foi cancelado. Entre em
            contato com a coordenação do seu comitê para obter um novo link.
          </Alerta>
        </div>
      </div>
    );
  }
  const contrato: DadosContratoAssinatura = {
    contratoId: linha.contrato_id,
    pessoaId: linha.pessoa_id,
    nomeCompleto: linha.nome_completo,
    primeiroNome: linha.primeiro_nome,
    cpf: linha.cpf,
    objeto: linha.objeto,
    valor: Number(linha.valor),
    valorExtenso: linha.valor_extenso,
    vigenciaInicio: linha.vigencia_inicio,
    vigenciaFim: linha.vigencia_fim,
    status: linha.status,
    organizacaoNome: linha.organizacao_nome,
    caminhoPdf: linha.caminho_pdf,
    assinadoEm: linha.assinado_em,
  };

  return <AssinarCliente token={token} contrato={contrato} />;
}
