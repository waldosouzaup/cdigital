import { buscarDadosDashboard } from "../dados";
import { ContratosFunilCliente } from "./contratos-funil-cliente";

export default async function FunilContratosPage({
  searchParams,
}: {
  searchParams: Promise<{ etapa?: string; objeto?: string }>;
}) {
  const { etapa, objeto } = await searchParams;
  const dados = await buscarDadosDashboard();

  return (
    <ContratosFunilCliente
      pessoas={dados.pessoas}
      regioes={dados.regioes}
      funil={dados.funil}
      etapaInicial={etapa ?? "cadastrados"}
      objetoInicial={objeto}
    />
  );
}
