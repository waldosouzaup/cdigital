"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import Image from "next/image";
import { Selo } from "./selo";

export function CapturaAssinatura({
  aoAlterar,
  desabilitado,
}: {
  aoAlterar: (arquivo: Blob | null) => void;
  desabilitado: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ponteiro = useRef<number | null>(null);
  const distancia = useRef(0);
  const ultima = useRef({ x: 0, y: 0 });
  const [preenchida, setPreenchida] = useState(false);
  function ponto(event: PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) * 800) / rect.width,
      y: ((event.clientY - rect.top) * 260) / rect.height,
    };
  }
  function limpar() {
    canvasRef.current?.getContext("2d")?.clearRect(0, 0, 800, 260);
    distancia.current = 0;
    setPreenchida(false);
    aoAlterar(null);
  }
  function iniciar(event: PointerEvent<HTMLCanvasElement>) {
    if (desabilitado || ponteiro.current !== null) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    ponteiro.current = event.pointerId;
    ultima.current = ponto(event);
    const ctx = event.currentTarget.getContext("2d");
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(ultima.current.x, ultima.current.y);
    }
  }
  function mover(event: PointerEvent<HTMLCanvasElement>) {
    if (ponteiro.current !== event.pointerId) return;
    const ctx = event.currentTarget.getContext("2d"),
      novo = ponto(event);
    distancia.current += Math.hypot(novo.x - ultima.current.x, novo.y - ultima.current.y);
    ultima.current = novo;
    if (ctx) {
      ctx.strokeStyle = "#14211c";
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineTo(novo.x, novo.y);
      ctx.stroke();
    }
  }
  function terminar(event: PointerEvent<HTMLCanvasElement>) {
    if (ponteiro.current !== event.pointerId) return;
    ponteiro.current = null;
    if (distancia.current > 60) {
      setPreenchida(true);
      event.currentTarget.toBlob(aoAlterar, "image/png");
    }
  }
  return (
    <section className="space-y-3" aria-labelledby="titulo-assinatura">
      <div className="flex items-center justify-between">
        <h2 id="titulo-assinatura" className="font-semibold">
          Sua assinatura
        </h2>
        <Selo voz="neutro" onClick={limpar} disabled={desabilitado}>
          Limpar
        </Selo>
      </div>
      <p id="ajuda-assinatura" className="text-small text-ink-muted">
        Assine no espaço abaixo usando o dedo, uma caneta ou o mouse.
      </p>
      <canvas
        ref={canvasRef}
        width={800}
        height={260}
        aria-label="Área para desenhar sua assinatura"
        aria-describedby="ajuda-assinatura"
        onPointerDown={iniciar}
        onPointerMove={mover}
        onPointerUp={terminar}
        onPointerCancel={terminar}
        className="w-full touch-none rounded-md border border-line bg-white"
      />
      <p role="status" className="text-xs text-ink-muted">
        {preenchida
          ? "Assinatura preenchida. Você pode limpar e refazer."
          : "A assinatura é obrigatória."}
      </p>
    </section>
  );
}

export function CapturaFoto({
  aoAlterar,
  desabilitado,
  titulo = "Foto do rosto",
  descricao = "Olhe para a câmera, mantenha o rosto visível e procure um local iluminado.",
  dica,
  numero = 1,
  etiqueta = "Identificação facial",
}: {
  aoAlterar: (arquivo: Blob | null) => void;
  desabilitado: boolean;
  titulo?: string;
  descricao?: string;
  dica?: string;
  numero?: number;
  etiqueta?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const montado = useRef(true);
  const [ativa, setAtiva] = useState(false),
    [iniciando, setIniciando] = useState(false),
    [erro, setErro] = useState("");
  const [previa, setPrevia] = useState<string | null>(null);
  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);
  useEffect(
    () => () => {
      if (previa) URL.revokeObjectURL(previa);
    },
    [previa],
  );
  async function abrirCamera() {
    setErro("");
    setIniciando(true);
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("camera");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 960 } },
        audio: false,
      });
      if (!montado.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      setAtiva(true);
      setPrevia(null);
      aoAlterar(null);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      setAtiva(false);
      setErro(
        "Não foi possível abrir a câmera diretamente no navegador. Permita o acesso ou utilize a opção 'Tirar com o celular' abaixo.",
      );
    } finally {
      setIniciando(false);
    }
  }
  function capturar() {
    const video = videoRef.current;
    if (!video?.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        aoAlterar(blob);
        setPrevia(URL.createObjectURL(blob));
        setAtiva(false);
        streamRef.current?.getTracks().forEach((t) => t.stop());
      },
      "image/jpeg",
      0.85,
    );
  }

  function handleArquivoManual(evento: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = evento.target.files?.[0];
    if (!arquivo) return;
    setErro("");
    setAtiva(false);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    aoAlterar(arquivo);
    setPrevia(URL.createObjectURL(arquivo));
  }

  return (
    <section
      className="space-y-3 p-4 rounded-lg border border-line bg-surface/40"
      aria-labelledby={`titulo-foto-${numero}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary font-mono text-xs font-bold">
            {numero}
          </span>
          <h3 id={`titulo-foto-${numero}`} className="font-semibold text-ink text-sm">
            {titulo}
          </h3>
        </div>
        {previa ? (
          <span className="text-xs font-mono text-success font-medium flex items-center gap-1">
            ✓ Foto anexada
          </span>
        ) : (
          <span className="text-[0.65rem] font-mono uppercase text-atencao bg-atencao/10 px-2 py-0.5 rounded border border-atencao/20">
            {etiqueta}
          </span>
        )}
      </div>

      <p className="text-small text-ink-muted leading-relaxed">
        {descricao}
      </p>

      {dica && (
        <div className="text-xs text-seal bg-surface border-l-2 border-seal pl-2.5 py-1 leading-normal">
          <strong>Atenção:</strong> {dica}
        </div>
      )}

      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={ativa ? "w-full max-h-80 rounded-md bg-black border border-line" : "hidden"}
        aria-label="Prévia da câmera"
      />

      {previa && (
        <div className="relative inline-block border-2 border-success/60 rounded-md overflow-hidden bg-black/5">
          <Image
            width={960}
            height={720}
            unoptimized
            src={previa}
            alt={titulo}
            className="max-h-56 w-auto rounded-md object-contain"
          />
        </div>
      )}

      {erro && (
        <p role="alert" className="text-small text-danger">
          {erro}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 pt-1">
        {ativa ? (
          <Selo onClick={capturar} disabled={desabilitado}>
            📸 Capturar foto agora
          </Selo>
        ) : (
          <Selo voz="neutro" onClick={abrirCamera} disabled={desabilitado || iniciando}>
            {iniciando ? "Abrindo câmera…" : previa ? "Tirar outra (Câmera ao vivo)" : "📸 Abrir câmera ao vivo"}
          </Selo>
        )}

        <label className="cursor-pointer inline-flex items-center text-xs text-ink-muted hover:text-ink font-medium px-3 py-2 border border-line rounded-md bg-surface hover:bg-canvas transition">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="user"
            className="hidden"
            disabled={desabilitado}
            onChange={handleArquivoManual}
          />
          <span>📱 {previa ? "Trocar por foto do celular" : "Tirar foto no celular / Anexar"}</span>
        </label>
      </div>
    </section>
  );
}
