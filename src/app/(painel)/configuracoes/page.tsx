/**
 * Configurações — modelos de contrato (Fase 2, item 7), identidade do comitê
 * (nome/CNPJ, item 4 do feedback do coordenador) e expurgo de retenção (Fase 4,
 * item 6) são reais. O resto da governança LGPD continua informativo.
 */
import { buscarIdentidadeComite, listarCampanhasSuperadmin, listarTemplates } from "./dados";
import { listarEquipe } from "../equipe/dados";
import { listarRegioesComContagem } from "../regioes/dados";
import { listarContextoAtividades } from "../atividades/dados";
import { ConfiguracoesCliente } from "./configuracoes-cliente";
import { createClient } from "@/lib/supabase/server";
import { obterContextoUsuario } from "@/lib/supabase/contexto-usuario";

export const metadata = { title: "Configurações & Governança — Comitê Digital" };

export default async function ConfiguracoesPage() {
  const supabase = await createClient();
  const [templates, identidade, membros, regioes, contextoAtividades, contexto] = await Promise.all([
    listarTemplates(),
    buscarIdentidadeComite(),
    listarEquipe(),
    listarRegioesComContagem(),
    listarContextoAtividades(),
    obterContextoUsuario(supabase),
  ]);

  const campanhas = contexto.papel === "superadmin" ? await listarCampanhasSuperadmin() : [];

  return (
    <ConfiguracoesCliente
      templatesIniciais={templates}
      identidadeInicial={identidade}
      membrosIniciais={membros}
      regioesIniciais={regioes}
      atividadesContexto={contextoAtividades}
      campanhasIniciais={campanhas}
      usuarioLogado={{ id: contexto.userId, papel: contexto.papel }}
    />
  );
}
