/**
 * Validação do cadastro/edição de um membro da equipe (Gestão de Acessos —
 * Feature A). Função pura; o Route Handler `/api/equipe/convite` e as Server
 * Actions de `/equipe` gravam só quando `ok`.
 *
 * `regiaoId` é obrigatório e precisa pertencer à organização QUANDO o papel é
 * `coord_regiao` (espelha o CHECK `usuarios_regiao_obrigatoria_coord` da migration
 * 0016); nos demais papéis a região é ignorada e normalizada para `null`.
 */
export interface EntradaUsuario {
  nome: string;
  email: string;
  papel: string;
  regiaoId: string;
}

export interface ValoresUsuario {
  nome: string;
  email: string;
  papel: string;
  regiaoId: string | null;
}

export type CampoUsuario = "nome" | "email" | "papel" | "regiaoId";

export type ResultadoUsuario =
  | { ok: true; valores: ValoresUsuario }
  | { ok: false; erros: Partial<Record<CampoUsuario, string>> };

export interface OpcoesValidacaoUsuario {
  /** Valores aceitos de `papel_usuario` (enum do schema). */
  papeisValidos: readonly string[];
  /** Ids de região da organização do gestor que está cadastrando. */
  regioesIds: readonly string[];
}

const MAX_NOME = 120;
const FORMA_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validarEntradaUsuario(
  entrada: EntradaUsuario,
  opcoes: OpcoesValidacaoUsuario,
): ResultadoUsuario {
  const erros: Partial<Record<CampoUsuario, string>> = {};

  const nome = (entrada.nome ?? "").trim().replace(/\s+/g, " ");
  if (!nome) {
    erros.nome = "Informe o nome do membro.";
  } else if (nome.length > MAX_NOME) {
    erros.nome = `Use no máximo ${MAX_NOME} caracteres.`;
  }

  const email = (entrada.email ?? "").trim().toLowerCase();
  if (!email) {
    erros.email = "Informe o e-mail de acesso.";
  } else if (!FORMA_EMAIL.test(email)) {
    erros.email = "E-mail inválido.";
  }

  const papel = (entrada.papel ?? "").trim();
  if (!papel) {
    erros.papel = "Selecione o papel.";
  } else if (!opcoes.papeisValidos.includes(papel)) {
    erros.papel = "Papel inválido.";
  }

  const regiaoBruta = (entrada.regiaoId ?? "").trim();
  let regiaoId: string | null = null;
  if (papel === "coord_regiao") {
    if (!regiaoBruta) {
      erros.regiaoId = "Coordenador regional precisa de uma região.";
    } else if (!opcoes.regioesIds.includes(regiaoBruta)) {
      erros.regiaoId = "Região não encontrada nesta organização.";
    } else {
      regiaoId = regiaoBruta;
    }
  }

  if (Object.keys(erros).length > 0) return { ok: false, erros };
  return { ok: true, valores: { nome, email, papel, regiaoId } };
}
