/**
 * Autoinscrição pública (/inscricao/[slug]) — Feature B. Sem login: a RPC
 * `dados_inscricao_publica` (SECURITY DEFINER, migration 0017) valida o slug e
 * devolve só o nome da campanha e as listas de região e função para o formulário.
 */
import { Marca } from "@/components/marca";
import { Alerta } from "@/components/alerta";
import { createClient } from "@/lib/supabase/server";
import { InscricaoCliente } from "./inscricao-cliente";

interface DadosInscricao {
  organizacao_id: string;
  organizacao_nome: string;
  regioes: { id: string; nome: string }[];
  funcoes: string[];
}

export default async function InscricaoPublicaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .rpc("dados_inscricao_publica", { p_slug: slug })
    .maybeSingle<DadosInscricao>();

  if (error || !data) {
    return (
      <div className="min-h-screen bg-canvas text-ink flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-md space-y-6 text-center">
          <Marca className="justify-center" />
          <Alerta tom="critico" titulo="Inscrições indisponíveis">
            Não há inscrições abertas neste endereço. Confira o link com a coordenação do
            comitê.
          </Alerta>
        </div>
      </div>
    );
  }

  return (
    <InscricaoCliente
      slug={slug}
      organizacaoNome={data.organizacao_nome}
      regioes={data.regioes}
      funcoes={data.funcoes}
    />
  );
}
