/**
 * Configurações — a seção de modelos de contrato (Fase 2, item 7) é real; o resto
 * da tela (identidade do comitê, governança LGPD) continua decorativo, fora do
 * escopo desta fase, e não finge ser real.
 */
import { listarTemplates } from "./dados";
import { ConfiguracoesCliente } from "./configuracoes-cliente";

export default async function ConfiguracoesPage() {
  const templates = await listarTemplates();

  return <ConfiguracoesCliente templatesIniciais={templates} />;
}
