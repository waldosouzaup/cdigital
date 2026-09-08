/**
 * Validação do nome de uma região de atuação — item 2 do feedback do coordenador.
 * Função pura; as Server Actions `criarRegiao`/`renomearRegiao` gravam só quando
 * `ok`.
 */
const MAX_NOME = 60;

export type ResultadoNomeRegiao = { ok: true; nome: string } | { ok: false; erro: string };

function chave(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function validarNomeRegiao(
  nomeBruto: string,
  nomesExistentes: string[],
  ignorar?: string,
): ResultadoNomeRegiao {
  const nome = (nomeBruto ?? "").trim().replace(/\s+/g, " ");
  if (!nome) return { ok: false, erro: "Informe o nome da região." };
  if (nome.length > MAX_NOME) return { ok: false, erro: `Use no máximo ${MAX_NOME} caracteres.` };

  const alvo = chave(nome);
  const ignorarChave = ignorar ? chave(ignorar) : null;
  const colide = nomesExistentes.some((e) => chave(e) === alvo && chave(e) !== ignorarChave);
  if (colide) return { ok: false, erro: "Já existe uma região com esse nome." };

  return { ok: true, nome };
}
