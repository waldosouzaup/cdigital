/**
 * Validação de Função Pretendida (Atividades da Inscrição).
 * Função pura: Server Actions só gravam quando `ok`.
 */
const MAX_NOME_FUNCAO = 80;
const MAX_DESCRICAO_FUNCAO = 255;

export type ResultadoValidacaoFuncao =
  | { ok: true; nome: string; descricao: string | null }
  | { ok: false; erro: string };

function chave(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function validarFuncaoPretendida(
  nomeBruto: string,
  descricaoBruta: string | undefined | null,
  nomesExistentes: string[],
  ignorar?: string,
): ResultadoValidacaoFuncao {
  const nome = (nomeBruto ?? "").trim().replace(/\s+/g, " ");
  if (!nome) return { ok: false, erro: "Informe o nome da função pretendida." };
  if (nome.length > MAX_NOME_FUNCAO) {
    return { ok: false, erro: `O nome deve ter no máximo ${MAX_NOME_FUNCAO} caracteres.` };
  }

  const alvo = chave(nome);
  const ignorarChave = ignorar ? chave(ignorar) : null;
  const colide = nomesExistentes.some((e) => chave(e) === alvo && chave(e) !== ignorarChave);
  if (colide) return { ok: false, erro: "Já existe uma função pretendida com esse nome." };

  const descricao = (descricaoBruta ?? "").trim().replace(/\s+/g, " ");
  if (descricao.length > MAX_DESCRICAO_FUNCAO) {
    return { ok: false, erro: `A descrição deve ter no máximo ${MAX_DESCRICAO_FUNCAO} caracteres.` };
  }

  return { ok: true, nome, descricao: descricao || null };
}
