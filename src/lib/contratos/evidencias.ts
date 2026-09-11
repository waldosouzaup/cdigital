import sharp from "sharp";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { sha256 } from "./documento";

export async function validarImagemAssinatura(bytes: Buffer, tipo: "assinatura" | "foto") {
  if (!bytes.length || bytes.length > 4 * 1024 * 1024)
    throw new Error("Cada imagem deve ter no máximo 4 MB.");
  const input = sharp(bytes, { limitInputPixels: 8_000_000, failOn: "warning" });
  const info = await input.metadata();
  if (!["png", "jpeg", "webp"].includes(info.format ?? "") || (info.pages ?? 1) > 1)
    throw new Error("Use uma imagem PNG, JPEG ou WebP válida.");
  if ((info.width ?? 0) < 100 || (info.height ?? 0) < 60)
    throw new Error("A imagem é pequena demais. Capture novamente.");
  const imagem = input
    .rotate()
    .flatten({ background: "#ffffff" })
    .resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true });
  const { data } = await imagem.clone().greyscale().raw().toBuffer({ resolveWithObject: true });
  let escuros = 0,
    claros = 0;
  for (const pixel of data) {
    if (pixel < 200) escuros++;
    if (pixel > 230) claros++;
  }
  if (tipo === "assinatura" && (escuros < 100 || claros < data.length * 0.25))
    throw new Error("Desenhe sua assinatura antes de continuar.");
  if (tipo === "foto" && (escuros < 100 || escuros > data.length * 0.999))
    throw new Error("A foto está sem detalhes. Tire outra foto com boa iluminação.");
  return imagem.png().toBuffer();
}

export async function anexarEvidenciasPdf(params: {
  original: Uint8Array;
  assinatura: Uint8Array;
  foto: Uint8Array;
  fotoDocumento?: Uint8Array;
  nome: string;
  cpf: string;
  contratoId: string;
  registradoEm: string;
}) {
  const pdf = await PDFDocument.load(params.original);
  const fonte = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage([595.28, 841.89]);
  const escrever = (texto: string, y: number, tamanho = 10) => {
    // Mantém o texto dentro da página e substitui caracteres sem glifo WinAnsi.
    const seguro = [...texto]
      .map((c) => {
        try {
          fonte.encodeText(c);
          return c;
        } catch {
          return "?";
        }
      })
      .join("");
    let x = "";
    for (const palavra of seguro.split(" ")) {
      const tentativa = x ? `${x} ${palavra}` : palavra;
      if (fonte.widthOfTextAtSize(tentativa, tamanho) > 480 && x) {
        page.drawText(x, { x: 56, y, size: tamanho, font: fonte });
        y -= 15;
        x = palavra;
      } else x = tentativa;
    }
    page.drawText(x, { x: 56, y, size: tamanho, font: fonte });
  };
  page.drawText("REGISTRO DE ASSINATURA ELETRÔNICA", { x: 56, y: 785, size: 14, font: bold });
  escrever(`Contrato: ${params.contratoId}`, 755);
  escrever(`Signatário: ${params.nome}`, 730);
  escrever(`CPF: ${params.cpf}`, 695);
  escrever(`Registro (UTC): ${params.registradoEm}`, 670);
  escrever("Assinatura desenhada na tela", 640);
  const assinatura = await pdf.embedPng(params.assinatura);
  const a = assinatura.scaleToFit(460, 110);
  page.drawImage(assinatura, { x: 56, y: 515, width: a.width, height: a.height });

  if (params.fotoDocumento) {
    escrever("Foto 1: Rosto para identificação", 495, 9);
    const foto1 = await pdf.embedPng(params.foto);
    const f1 = foto1.scaleToFit(220, 165);
    page.drawImage(foto1, { x: 56, y: 320, width: f1.width, height: f1.height });

    escrever("Foto 2: Titular segurando documento", 495, 9);
    const foto2 = await pdf.embedPng(params.fotoDocumento);
    const f2 = foto2.scaleToFit(220, 165);
    page.drawImage(foto2, { x: 300, y: 320, width: f2.width, height: f2.height });

    escrever(
      "Aceite: li e concordo com o contrato e autorizo o registro da assinatura e das 2 fotos de identificação.",
      295,
      8.5,
    );
    escrever("SHA-256 do PDF apresentado antes da assinatura:", 270, 8);
    escrever(sha256(params.original), 255, 7);
    escrever("SHA-256 da assinatura:", 235, 8);
    escrever(sha256(params.assinatura), 220, 7);
    escrever("SHA-256 da Foto 1 (Rosto):", 200, 8);
    escrever(sha256(params.foto), 185, 7);
    escrever("SHA-256 da Foto 2 (Rosto com documento):", 165, 8);
    escrever(sha256(params.fotoDocumento), 150, 7);
  } else {
    escrever("Foto capturada pelo colaborador", 465);
    const foto = await pdf.embedPng(params.foto);
    const f = foto.scaleToFit(220, 205);
    page.drawImage(foto, { x: 56, y: 240, width: f.width, height: f.height });
    escrever(
      "Aceite: li e concordo com o contrato e autorizo o registro da assinatura e da foto.",
      210,
    );
    escrever("SHA-256 do PDF apresentado antes da assinatura:", 175, 9);
    escrever(sha256(params.original), 155, 8);
    escrever("SHA-256 da assinatura:", 130, 9);
    escrever(sha256(params.assinatura), 115, 8);
    escrever("SHA-256 da foto:", 90, 9);
    escrever(sha256(params.foto), 75, 8);
  }
  return pdf.save();
}
