"use client";

import { useEffect, useState } from "react";
import { Marca } from "@/components/marca";
import { Badge } from "@/components/badge";
import { Alerta } from "@/components/alerta";
import { SeletorTema } from "@/components/seletor-tema";
import { CapturaAssinatura, CapturaFoto } from "@/components/captura-assinatura";

export interface DadosContratoAssinatura {
  contratoId: string;
  pessoaId: string;
  nomeCompleto: string;
  primeiroNome: string;
  cpf: string;
  objeto: string;
  valor: number;
  valorExtenso: string;
  vigenciaInicio: string;
  vigenciaFim: string;
  status: "enviado" | "assinado";
  organizacaoNome: string;
  caminhoPdf: string | null;
  assinadoEm: string | null;
}

function formatarDataBR(isoDate?: string | null): string {
  if (!isoDate) return "—";
  const partes = isoDate.split("T")[0].split("-");
  if (partes.length !== 3) return isoDate;
  const [ano, mes, dia] = partes;
  return `${dia}/${mes}/${ano}`;
}

function formatarDataHoraBR(isoTimestamp?: string | null): string {
  if (!isoTimestamp) return "—";
  try {
    const data = new Date(isoTimestamp);
    return data.toLocaleString("pt-BR", {
      dateStyle: "short",
      timeStyle: "medium",
    });
  } catch {
    return isoTimestamp;
  }
}

export function AssinarCliente({
  token,
  contrato,
}: {
  token: string;
  contrato: DadosContratoAssinatura;
}) {
  const [statusAtual, setStatusAtual] = useState(contrato.status);
  const [assinadoEm, setAssinadoEm] = useState(contrato.assinadoEm);
  const [concordou, setConcordou] = useState(false);
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [assinatura, setAssinatura] = useState<Blob | null>(null);
  const [fotoRosto, setFotoRosto] = useState<Blob | null>(null);
  const [fotoDocumento, setFotoDocumento] = useState<Blob | null>(null);
  const [documentoHash, setDocumentoHash] = useState("");
  const [textoContrato, setTextoContrato] = useState<string | null>(null);
  const [documentoPronto, setDocumentoPronto] = useState(false);
  const pdfUrl = `/api/contratos/publico/${token}/pdf`;
  useEffect(() => {
    const controller = new AbortController();
    setDocumentoHash("");
    setDocumentoPronto(false);
    fetch(`${pdfUrl}?formato=leitura`, { signal: controller.signal, cache: "no-store" })
      .then(async (resposta) => {
        if (!resposta.ok)
          throw new Error(
            "Não foi possível carregar o contrato. Recarregue a página ou contate a coordenação.",
          );
        const documento = await resposta.json();
        if (controller.signal.aborted) return;
        setTextoContrato(documento.texto);
        setDocumentoHash(documento.hash);
        setDocumentoPronto(true);
      })
      .catch((erro) => {
        if (!controller.signal.aborted) setErro(erro.message);
      });
    return () => controller.abort();
  }, [pdfUrl, statusAtual]);

  async function handleAssinar() {
    if (!concordou || !assinatura || !fotoRosto || !fotoDocumento || !documentoHash) {
      setErro("Confira o contrato, desenhe sua assinatura, capture as 2 fotos (rosto e segurando documento) e confirme o aceite.");
      return;
    }
    setErro(null);
    setProcessando(true);
    try {
      const form = new FormData();
      form.append("assinatura", assinatura, "assinatura.png");
      form.append("foto", fotoRosto, "foto_rosto.jpg");
      form.append("foto_documento", fotoDocumento, "foto_documento.jpg");
      form.append("consentimento", "true");
      form.append("documentoHash", documentoHash);
      const resposta = await fetch(`/api/contratos/publico/${token}/assinatura`, {
        method: "POST",
        body: form,
      });
      const resultado = await resposta.json();
      if (!resposta.ok || !resultado.ok) {
        setErro(resultado.mensagem ?? "Não foi possível concluir a assinatura.");
        return;
      }
      setStatusAtual("assinado");
      setAssinadoEm(resultado.assinadoEm);
    } catch {
      setErro("Falha de conexão. Sua assinatura e fotos continuam nesta tela; tente novamente.");
    } finally {
      setProcessando(false);
    }
  }

  const jaAssinado = statusAtual === "assinado";

  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col justify-between">
      {/* Barra de Topo */}
      <header className="border-b border-line bg-surface px-4 py-3 shadow-sm">
        <div className="mx-auto max-w-2xl flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Marca className="text-small" />
            <span className="hidden sm:block text-[0.7rem] font-mono text-ink-muted border-l border-line pl-2">
              ASSINATURA ELETRÔNICA
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <SeletorTema />
            <Badge
              status={jaAssinado ? "assinado" : "enviado"}
              rotuloPersonalizado={jaAssinado ? "Assinado ✓" : "Aguardando assinatura"}
            />
          </div>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="flex-1 mx-auto w-full max-w-2xl px-4 py-8">
        <div className="space-y-6">
          {/* Cabeçalho do documento */}
          <div className="space-y-2 border-b border-line pb-5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono uppercase tracking-wider text-primary font-semibold">
                Termo de Prestação de Serviços
              </span>
              <span className="text-xs text-ink-muted">·</span>
              <span className="text-xs text-ink-muted">Campanha 2026</span>
            </div>
            <h1 className="text-h1 font-semibold text-ink leading-tight">
              {jaAssinado ? "Contrato Assinado com Sucesso" : `Olá, ${contrato.primeiroNome}`}
            </h1>
            <p className="text-small text-ink-muted leading-relaxed">
              {jaAssinado
                ? "Sua assinatura e fotos foram registradas. O PDF completo foi arquivado e está disponível abaixo."
                : `Confira os termos e cláusulas do seu contrato de prestação de serviços com ${contrato.organizacaoNome}, assine na tela e capture as 2 fotos de identificação abaixo.`}
            </p>
          </div>

          {/* Estado de Sucesso / Já Assinado */}
          {jaAssinado ? (
            <div className="space-y-6">
              <div className="border border-success/40 bg-surface p-6 space-y-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-success/15 flex items-center justify-center text-success text-xl font-bold">
                    ✓
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-ink">
                      Assinatura Eletrônica Concluída
                    </h2>
                    <span className="text-xs font-mono text-ink-muted">
                      Registrada em {formatarDataHoraBR(assinadoEm)}
                    </span>
                  </div>
                </div>

                <div className="border-t border-line/60 pt-4 space-y-2 text-small">
                  <div className="flex justify-between py-1 border-b border-line/30">
                    <span className="text-ink-muted">Signatário(a):</span>
                    <strong className="text-ink">{contrato.nomeCompleto}</strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-line/30">
                    <span className="text-ink-muted">CPF:</span>
                    <span className="font-mono text-ink">{contrato.cpf}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-line/30">
                    <span className="text-ink-muted">Objeto Contratual:</span>
                    <span className="text-ink font-medium">{contrato.objeto}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-line/30">
                    <span className="text-ink-muted">Vigência:</span>
                    <span className="text-ink font-mono text-xs">
                      {formatarDataBR(contrato.vigenciaInicio)} a{" "}
                      {formatarDataBR(contrato.vigenciaFim)}
                    </span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-ink-muted">Remuneração:</span>
                    <span className="text-ink font-mono font-semibold">
                      R${" "}
                      {contrato.valor.toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                </div>

                <div className="pt-3">
                  <a
                    href={pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-2 py-3 bg-paper border border-seal text-ink hover:bg-seal/10 font-semibold text-small cursor-pointer transition-colors shadow-sm"
                  >
                    <span>📄 Visualizar / Baixar Contrato em PDF</span>
                    <span className="text-seal font-mono">↗</span>
                  </a>
                </div>
              </div>

              <div className="p-4 bg-surface border border-line text-xs text-ink-muted space-y-1.5 leading-relaxed">
                <strong className="text-ink block">Registro do documento</strong>
                <p>
                  O PDF reúne o contrato apresentado, a assinatura desenhada, a foto e a data do
                  aceite. Uma cópia permanece arquivada no comitê.
                </p>
              </div>
            </div>
          ) : (
            /* Fluxo de Assinatura */
            <div className="space-y-6">
              {erro && (
                <Alerta tom="critico" titulo="Atenção">
                  {erro}
                </Alerta>
              )}

              {/* Resumo do Contrato */}
              <div className="bg-surface border border-line p-5 space-y-3 text-small">
                <span className="text-xs font-mono uppercase tracking-wider text-seal block font-semibold">
                  Dados do Contrato
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-ink-muted block">Contratado(a):</span>
                    <span className="text-ink font-semibold">{contrato.nomeCompleto}</span>
                    <span className="block font-mono text-ink-muted mt-0.5">
                      CPF: {contrato.cpf}
                    </span>
                  </div>

                  <div>
                    <span className="text-ink-muted block">Objeto / Função:</span>
                    <span className="text-ink font-semibold">{contrato.objeto}</span>
                  </div>

                  <div>
                    <span className="text-ink-muted block">Remuneração:</span>
                    <span className="text-ink font-semibold font-mono">
                      R${" "}
                      {contrato.valor.toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                    <span className="block text-[0.7rem] text-ink-muted mt-0.5">
                      ({contrato.valorExtenso})
                    </span>
                  </div>

                  <div>
                    <span className="text-ink-muted block">Período de Vigência:</span>
                    <span className="text-ink font-mono">
                      {formatarDataBR(contrato.vigenciaInicio)} a{" "}
                      {formatarDataBR(contrato.vigenciaFim)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Prévia do PDF do Contrato */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono uppercase tracking-wider text-seal font-semibold">
                    Contrato completo
                  </span>
                  <a
                    href={pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-seal hover:underline font-medium flex items-center gap-1"
                  >
                    <span>Abrir em tela cheia</span>
                    <span className="font-mono">↗</span>
                  </a>
                </div>

                <div className="border border-line bg-paper overflow-hidden shadow-inner">
                  {documentoPronto ? (
                    textoContrato ? (
                      <article
                        aria-label="Texto integral do contrato"
                        className="max-h-[560px] overflow-y-auto bg-white px-5 py-6 text-sm leading-7 text-slate-900 whitespace-pre-line break-words"
                        tabIndex={0}
                      >
                        <h2 className="mb-5 font-semibold text-center">
                          CONTRATO DE PRESTAÇÃO DE SERVIÇOS
                        </h2>
                        {textoContrato}
                      </article>
                    ) : (
                      <iframe
                        src={pdfUrl}
                        title="Visualização do Contrato em PDF"
                        className="w-full h-[420px] bg-paper"
                      />
                    )
                  ) : (
                    <p className="p-5 text-small" role="status">
                      Carregando contrato completo…
                    </p>
                  )}
                </div>
              </div>

              <div className="bg-surface border border-line p-5 space-y-6">
                <CapturaAssinatura aoAlterar={setAssinatura} desabilitado={processando} />

                <div className="border-t border-line pt-6 space-y-4">
                  <div>
                    <h2 className="text-base font-semibold text-ink flex items-center gap-2">
                      <span>Evidências Fotográficas &amp; Prova de Vida</span>
                      <span className="text-[0.6875rem] font-mono uppercase text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
                        2 Fotos Obrigatórias
                      </span>
                    </h2>
                    <p className="text-xs text-ink-muted mt-1 leading-relaxed">
                      Para comprovar a autoria da assinatura e a autenticidade do documento perante a Justiça Eleitoral, capture as 2 fotos a seguir:
                    </p>
                  </div>

                  <CapturaFoto
                    numero={1}
                    titulo="Foto 1: Rosto para identificação"
                    etiqueta="Identificação Facial"
                    descricao="Olhe para a câmera com o rosto totalmente visível e em local bem iluminado."
                    dica="Mantenha o rosto centralizado e evite acessórios que cubram a face."
                    aoAlterar={setFotoRosto}
                    desabilitado={processando}
                  />

                  <CapturaFoto
                    numero={2}
                    titulo="Foto 2: Usuário segurando o documento de identificação ao lado do rosto"
                    etiqueta="Prova de Titularidade"
                    descricao="Tire uma foto segurando seu documento oficial (RG ou CNH aberto) ao lado do seu rosto. O rosto e os dados do documento devem estar nítidos."
                    dica="Desta forma o sistema comprova que é você mesmo assinando e que a documentação apresentada é autêntica."
                    imagemOrientacao="/images/orientacao-foto-documento.png"
                    aoAlterar={setFotoDocumento}
                    desabilitado={processando}
                  />
                </div>
              </div>
              {/* Termo de Concordância & Botão de Assinatura */}
              <div className="bg-surface border border-line p-5 space-y-4">
                <label className="flex items-start gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={concordou}
                    onChange={(e) => setConcordou(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-line text-seal focus:ring-seal cursor-pointer"
                  />
                  <span className="text-small text-ink leading-relaxed">
                    Declaro que li integralmente o contrato em PDF acima, concordo com todas as suas
                    cláusulas, condições e remuneração descritas, e manifesto minha concordância por
                    meio desta <strong>assinatura eletrônica</strong>. Autorizo o registro da
                    assinatura e das 2 fotos de identificação (rosto e selfie segurando documento) junto ao contrato, para documentar este
                    aceite.
                  </span>
                </label>

                <button
                  type="button"
                  disabled={!concordou || !assinatura || !fotoRosto || !fotoDocumento || !documentoHash || processando}
                  onClick={handleAssinar}
                  className="w-full py-4 bg-seal text-paper hover:opacity-90 font-semibold text-base cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md flex items-center justify-center gap-2"
                >
                  {processando ? (
                    <>
                      <span className="animate-spin text-lg">⟳</span>
                      <span>Registrando Assinatura Eletrônica…</span>
                    </>
                  ) : (
                    <span>Assinar e concluir</span>
                  )}
                </button>

                <p className="text-[0.7rem] text-ink-muted text-center leading-relaxed">
                  O PDF assinado será gerado e anexado automaticamente. Aguarde a confirmação antes
                  de fechar esta página.
                </p>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Rodapé */}
      <footer className="border-t border-line bg-surface/50 px-4 py-4 mt-8 text-center text-xs text-ink-muted">
        <p>Comitê Digital 2026 · Gestão Eleitoral, Auditoria & Governança Jurídica</p>
      </footer>
    </div>
  );
}
