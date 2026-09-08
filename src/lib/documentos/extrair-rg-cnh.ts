/**
 * Extração de sugestões de nome e CPF a partir do texto bruto do OCR de um RG ou
 * CNH — Fase 4, item 3.
 *
 * Só sugere. A gravação acontece na Server Action de cadastro, depois que a
 * pessoa confirma o que o OCR propôs ("OCR nunca grava sem confirmação").
 * Lógica pura e testável, separada do `tesseract.js`, que roda no navegador.
 */
import { isValidCpf, stripCpf } from "./cpf";

export interface SugestoesDocumento {
  nome: string | null;
  cpf: string | null;
  confianca: "alta" | "media" | "baixa";
}

// Palavras que aparecem nos cabeçalhos/rótulos de RG e CNH e nunca são o nome.
const RUIDO_CABECALHO = [
  "REPUBLICA",
  "FEDERATIVA",
  "BRASIL",
  "CARTEIRA",
  "IDENTIDADE",
  "NACIONAL",
  "HABILITACAO",
  "MINISTERIO",
  "INFRAESTRUTURA",
  "SECRETARIA",
  "INSTITUTO",
  "REGISTRO",
  "GERAL",
  "NOME",
  "FILIACAO",
  "NATURALIDADE",
  "DOC",
  "ORIGEM",
  "CERTIDAO",
  "NASCIMENTO",
  "VALIDA",
  "TERRITORIO",
  "ASSINATURA",
  "PORTADOR",
  "DIRETOR",
  "PERMISSAO",
  "CATEGORIA",
];

function semAcento(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function formatarCpf(digitos: string): string {
  return digitos.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

function acharCpf(texto: string): string | null {
  const candidatos = texto.match(/\d{3}[.\s]?\d{3}[.\s]?\d{3}[-\s]?\d{2}/g) ?? [];
  for (const candidato of candidatos) {
    const digitos = stripCpf(candidato);
    if (digitos.length === 11 && isValidCpf(digitos)) {
      return formatarCpf(digitos);
    }
  }
  return null;
}

// Remove prefixo de item numerado ("2 - ") e um rótulo "NOME"/"NAME" inline.
function semRotulo(linha: string): string {
  return linha
    .replace(/^\s*\d+\s*[-.)]\s*/, "")
    .replace(/^\s*(?:nome|name)\s*(?:completo)?\s*[:.\-]?\s*/i, "")
    .trim();
}

function ehLinhaDeNome(linha: string): boolean {
  // Só letras (com acento), espaços e pontos; 2+ palavras; comprimento plausível.
  const limpa = semRotulo(linha);
  if (limpa.length < 6 || limpa.length > 60) return false;
  if (!/^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ.'\s]+$/.test(limpa)) return false;
  const palavras = limpa.split(/\s+/).filter(Boolean);
  // Nome próprio: 2 a 6 tokens. Cabeçalhos costumam ser mais longos quando o OCR
  // funde linhas ("CARTEIRA DE IDENTIDADE JOAO DA SILVA").
  if (palavras.length < 2 || palavras.length > 6) return false;
  // Qualquer palavra de cabeçalho descarta a linha — nome de pessoa não contém
  // "BRASIL", "CARTEIRA", "NACIONAL" etc.
  const temRuido = palavras.some((p) =>
    RUIDO_CABECALHO.includes(semAcento(p).toUpperCase().replace(/[^A-Z]/g, "")),
  );
  if (temRuido) return false;
  return true;
}

function normalizarNome(linha: string): string {
  return semRotulo(linha).replace(/\s+/g, " ");
}

function acharNome(texto: string): string | null {
  const linhas = texto
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  // 1) Linha seguinte a um rótulo "NOME".
  for (let i = 0; i < linhas.length - 1; i++) {
    if (/\bNOME\b/i.test(semAcento(linhas[i])) && !ehLinhaDeNome(linhas[i])) {
      const proxima = linhas[i + 1];
      if (ehLinhaDeNome(proxima)) return normalizarNome(proxima);
    }
  }

  // 2) Primeira linha que parece um nome próprio.
  for (const linha of linhas) {
    if (ehLinhaDeNome(linha)) return normalizarNome(linha);
  }

  return null;
}

export function extrairSugestoesDocumento(textoOcr: string): SugestoesDocumento {
  const cpf = acharCpf(textoOcr);
  const nome = acharNome(textoOcr);

  let confianca: SugestoesDocumento["confianca"] = "baixa";
  if (cpf && nome) confianca = "alta";
  else if (cpf || nome) confianca = "media";

  return { nome, cpf, confianca };
}
