"use client";

/**
 * Tela de assinatura do termo de distrato.
 *
 * Pede menos que a assinatura do contrato de entrada: desenho e foto do rosto,
 * sem a segunda foto segurando o documento. A identidade da pessoa já foi
 * conferida na contratação — repetir a exigência na saída só aumentaria a
 * chance de a rescisão ficar pendente por atrito.
 *
 * O termo é exibido como PDF em iframe: é exatamente o arquivo cujo SHA-256 será
 * conferido no servidor, não uma representação dele.
 */
import { useState } from "react";
import { Marca } from "@/components/marca";
import { Alerta } from "@/components/alerta";
import { Selo } from "@/components/selo";
import { CapturaAssinatura, CapturaFoto } from "@/components/captura-assinatura";

export interface DadosDistratoAssinatura {
  contratoId: string;
  nomeCompleto: string;
  primeiroNome: string;
  cpf: string;
  objeto: string;
  vigenciaInicio: string;
  vigenciaFim: string;
  status: "distratado" | "distrato_assinado";
  organizacaoNome: string;
  termoSha256: string | null;
  assinadoEm: string | null;
}

function formatarData(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  });
}

export function AssinarDistratoCliente({
  token,
  distrato,
}: {
  token: string;
  distrato: DadosDistratoAssinatura;
}) {
  const [statusAtual, setStatusAtual] = useState(distrato.status);
  const [assinadoEm, setAssinadoEm] = useState(distrato.assinadoEm);
  const [concordou, setConcordou] = useState(false);
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [assinatura, setAssinatura] = useState<Blob | null>(null);
  const [fotoRosto, setFotoRosto] = useState<Blob | null>(null);

  const pdfUrl = `/api/distratos/publico/${token}/pdf`;
  const jaAssinado = statusAtual === "distrato_assinado";

  async function handleAssinar() {
    if (!concordou || !assinatura || !fotoRosto || !distrato.termoSha256) {
      setErro(
        "Leia o termo, desenhe sua assinatura, capture a foto do rosto e confirme o aceite.",
      );
      return;
    }
    setErro(null);
    setProcessando(true);
    try {
      const form = new FormData();
      form.append("assinatura", assinatura, "assinatura.png");
      form.append("foto", fotoRosto, "foto_rosto.jpg");
      form.append("consentimento", "true");
      form.append("documentoHash", distrato.termoSha256);

      const resposta = await fetch(`/api/distratos/publico/${token}/assinatura`, {
        method: "POST",
        body: form,
      });
      const resultado = await resposta.json();

      if (!resposta.ok || !resultado.ok) {
        setErro(resultado.mensagem ?? "Não foi possível concluir a assinatura.");
        return;
      }
      setStatusAtual("distrato_assinado");
      setAssinadoEm(resultado.assinadoEm);
    } catch {
      setErro("Falha de conexão. Sua assinatura e foto continuam nesta tela; tente de novo.");
    } finally {
      setProcessando(false);
    }
  }

  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col">
      <header className="border-b border-line bg-surface px-4 py-3">
        <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Marca className="text-small" />
            <span className="hidden border-l border-line pl-2 font-mono text-[0.7rem] text-ink-muted sm:block">
              DISTRATO · ASSINATURA ELETRÔNICA
            </span>
          </div>
          <span className="font-mono text-[0.7rem] text-ink-muted">
            {distrato.organizacaoNome}
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-6">
        {jaAssinado ? (
          <>
            <Alerta tom="sucesso" titulo="Distrato assinado">
              A rescisão está formalizada desde {formatarData(assinadoEm)}. Nada mais é necessário
              da sua parte — guarde a sua via em PDF.
            </Alerta>
            <div className="rounded-lg border border-line bg-surface p-5">
              <a
                href={`${pdfUrl}?download=1`}
                className="inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-small font-semibold text-white transition-colors hover:bg-primary-hover"
              >
                Baixar o termo assinado (PDF)
              </a>
            </div>
          </>
        ) : (
          <div className="rounded-lg border border-line bg-surface p-5">
            <h1 className="text-h2 font-semibold text-ink">
              {distrato.primeiroNome}, seu distrato aguarda assinatura
            </h1>
            <p className="mt-2 text-small leading-relaxed text-ink-muted">
              A rescisão do contrato de <strong className="text-ink">{distrato.objeto}</strong> só
              é considerada concluída depois que você assinar o termo abaixo.
            </p>
          </div>
        )}

        <section className="space-y-2">
          <h2 className="font-mono text-[0.7rem] uppercase tracking-wider text-ink-muted">
            Termo de distrato
          </h2>
          <iframe
            src={pdfUrl}
            title="Termo de distrato em PDF"
            className="h-[60vh] w-full rounded-lg border border-line bg-white"
          />
          <p className="text-xs text-ink-muted">
            Não consegue ver o documento?{" "}
            <a href={pdfUrl} target="_blank" rel="noreferrer" className="text-primary underline">
              Abrir em uma nova aba
            </a>
            .
          </p>
        </section>

        {!jaAssinado && (
          <>
            <section className="space-y-2">
              <h2 className="font-mono text-[0.7rem] uppercase tracking-wider text-ink-muted">
                Sua assinatura
              </h2>
              <CapturaAssinatura aoAlterar={setAssinatura} desabilitado={processando} />
            </section>

            <CapturaFoto
              aoAlterar={setFotoRosto}
              desabilitado={processando}
              titulo="Foto do rosto"
              descricao="Olhe para a câmera num local iluminado. A foto fica anexada ao termo como evidência da assinatura."
              etiqueta="Identificação facial"
              numero={1}
            />

            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-line bg-surface p-4 text-small leading-relaxed">
              <input
                type="checkbox"
                id="aceite-distrato"
                checked={concordou}
                onChange={(e) => setConcordou(e.target.checked)}
                disabled={processando}
                className="mt-0.5 size-4 shrink-0 accent-primary"
              />
              <span className="text-ink-muted">
                Declaro que li o termo de distrato acima, concordo com a rescisão e com o valor
                proporcional nele descrito, e autorizo o registro da minha assinatura e foto como
                evidência.
              </span>
            </label>

            {erro && <Alerta tom="critico">{erro}</Alerta>}

            <Selo
              voz="selo"
              onClick={handleAssinar}
              carregando={processando}
              textoCarregando="Registrando assinatura…"
              disabled={processando || !concordou || !assinatura || !fotoRosto}
              className="w-full"
            >
              Assinar o termo de distrato
            </Selo>

            <p className="pb-4 text-center text-xs text-ink-muted">
              Assinado por {distrato.nomeCompleto}. Data, hora, endereço de rede e as imagens ficam
              registrados junto ao documento.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
