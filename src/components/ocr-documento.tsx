"use client";

import { useState, type ChangeEvent } from "react";
import {
  extrairSugestoesDocumento,
  type SugestoesDocumento,
} from "@/lib/documentos/extrair-rg-cnh";
import { Alerta } from "./alerta";
import { Selo } from "./selo";

/**
 * OCR de RG/CNH — Fase 4, item 3. Roda `tesseract.js` no navegador (a imagem não
 * sai do dispositivo até a pessoa confirmar) e mostra o que extraiu como
 * *sugestão editável*. `onConfirmar` só dispara no clique do botão — e mesmo aí
 * apenas preenche o formulário; a gravação continua sendo a ação "Salvar" que o
 * coordenador aciona depois. Duas confirmações humanas antes de qualquer escrita.
 */
export function OcrDocumento({
  onConfirmar,
}: {
  onConfirmar: (dados: { nome?: string; cpf?: string }) => void;
}) {
  const [processando, setProcessando] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [sugestoes, setSugestoes] = useState<SugestoesDocumento | null>(null);
  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  async function aoEscolherArquivo(evento: ChangeEvent<HTMLInputElement>) {
    const arquivo = evento.target.files?.[0];
    if (!arquivo) return;
    setErro(null);
    setSugestoes(null);
    setProcessando(true);
    setProgresso(0);

    try {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("por", 1, {
        logger: (m) => {
          if (m.status === "recognizing text") setProgresso(Math.round(m.progress * 100));
        },
      });
      const { data } = await worker.recognize(arquivo);
      await worker.terminate();

      const extraido = extrairSugestoesDocumento(data.text);
      setSugestoes(extraido);
      setNome(extraido.nome ?? "");
      setCpf(extraido.cpf ?? "");
    } catch {
      setErro("Não foi possível ler o documento. Preencha os campos manualmente.");
    } finally {
      setProcessando(false);
    }
  }

  return (
    <div className="space-y-3 border border-line bg-surface/50 p-3">
      <label className="block text-small font-medium text-ink">
        Foto do RG ou CNH (opcional)
        <input
          type="file"
          accept="image/*"
          // `capture` abre a câmera direto no celular do coordenador.
          capture="environment"
          onChange={aoEscolherArquivo}
          disabled={processando}
          className="mt-1.5 block w-full text-xs text-ink-muted file:mr-3 file:border file:border-line file:bg-surface file:px-3 file:py-1.5 file:text-xs file:text-ink"
        />
      </label>

      {processando && (
        <p className="font-mono text-xs text-ink-muted" role="status">
          Lendo o documento no aparelho… {progresso}%
        </p>
      )}

      {erro && <Alerta tom="atencao">{erro}</Alerta>}

      {sugestoes && (
        <div className="space-y-2" data-testid="ocr-sugestoes">
          <p className="text-xs text-ink-muted">
            O OCR sugeriu os dados abaixo (confiança {sugestoes.confianca}). Confira e ajuste — nada
            é salvo automaticamente.
          </p>
          <label className="block text-xs text-ink">
            Nome sugerido
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="mt-1 w-full border-b border-line bg-transparent py-1 text-small text-ink outline-none focus:border-seal"
            />
          </label>
          <label className="block text-xs text-ink">
            CPF sugerido
            <input
              value={cpf}
              onChange={(e) => setCpf(e.target.value)}
              className="mt-1 w-full border-b border-line bg-transparent py-1 font-mono text-small text-ink outline-none focus:border-seal"
            />
          </label>
          <Selo
            voz="neutro"
            className="text-xs"
            onClick={() => onConfirmar({ nome: nome || undefined, cpf: cpf || undefined })}
          >
            Usar estes dados no formulário
          </Selo>
        </div>
      )}
    </div>
  );
}
