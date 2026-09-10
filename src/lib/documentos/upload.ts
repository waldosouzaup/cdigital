/**
 * Validação síncrona de upload — Fase 2, item 3: "menor dimensão da imagem >= 800px,
 * senão rejeita informando o motivo em linguagem simples"; "tipos JPG, PNG, PDF;
 * limite de 20 MB". Tudo aqui roda ANTES de qualquer escrita em Storage ou banco —
 * são funções puras (exceto a leitura de metadata do sharp, que não toca disco nem
 * rede).
 */
import sharp from "sharp";
import { createHash } from "node:crypto";

export const TIPOS_ACEITOS = ["image/jpeg", "image/png", "application/pdf"] as const;
export type TipoAceito = (typeof TIPOS_ACEITOS)[number];

export const TIPOS_DOCUMENTO_VALIDOS = ["documento_identidade", "comprovante_endereco"] as const;
export type TipoDocumentoColeta = (typeof TIPOS_DOCUMENTO_VALIDOS)[number];

export const TAMANHO_MAXIMO_BYTES = 20 * 1024 * 1024;
export const DIMENSAO_MINIMA_PX = 800;

export interface ResultadoValidacaoArquivo {
  ok: boolean;
  motivo?: string;
  largura?: number;
  altura?: number;
}

export function validarTipoETamanho(mime: string, bytes: number): ResultadoValidacaoArquivo {
  if (!(TIPOS_ACEITOS as readonly string[]).includes(mime)) {
    return { ok: false, motivo: "Envie uma foto em JPG ou PNG, ou um arquivo PDF." };
  }
  if (bytes > TAMANHO_MAXIMO_BYTES) {
    return { ok: false, motivo: "O arquivo é maior que o limite de 20 MB." };
  }
  return { ok: true };
}

export async function validarDimensaoImagem(
  buffer: Buffer,
  mime: string,
): Promise<ResultadoValidacaoArquivo> {
  // A regra de dimensão mínima é só para imagem — PDF não tem "pixel".
  if (mime === "application/pdf") return { ok: true };

  const metadata = await sharp(buffer).metadata();
  // `autoOrient` contabiliza a rotação salva no EXIF (Context 7: lovell/sharp) — uma
  // foto de celular tirada na vertical pode vir com width/height "deitados" sem isso,
  // o que erraria a checagem de dimensão exatamente no caso de uso real (campo).
  const largura = metadata.autoOrient?.width ?? metadata.width ?? 0;
  const altura = metadata.autoOrient?.height ?? metadata.height ?? 0;
  const menorDimensao = Math.min(largura, altura);

  if (menorDimensao < DIMENSAO_MINIMA_PX) {
    return {
      ok: false,
      motivo:
        `A imagem enviada tem resolução baixa (${largura} × ${altura} px). ` +
        `Tire uma foto mais nítida e mais próxima do documento — o sistema exige no ` +
        `mínimo ${DIMENSAO_MINIMA_PX}px no lado menor.`,
      largura,
      altura,
    };
  }

  return { ok: true, largura, altura };
}

export function calcularHashSha256(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

const EXTENSAO_POR_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "application/pdf": "pdf",
};

/** Extensão gerada a partir do tipo MIME real do arquivo — nunca do nome que a
 * pessoa deu (Fase 2, item 4: "nunca permitir que o usuário digite o nome de um
 * arquivo enviado"). `null` só é possível se chamada fora de `TIPOS_ACEITOS`. */
export function extensaoPorMime(mime: string): string | null {
  return EXTENSAO_POR_MIME[mime] ?? null;
}
