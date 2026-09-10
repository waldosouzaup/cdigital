import Link from "next/link";
import { Marca } from "@/components/marca";
import { SeletorTema } from "@/components/seletor-tema";

const modulos = [
  {
    id: "pessoas",
    icone: "👥",
    titulo: "Quadro de Pessoas e Equipes",
    descricao:
      "Cadastro centralizado com validação de CPF por dígito verificador, distribuição por região e checagem imediata de aptidão jurídica.",
    destaques: ["Unicidade por CPF", "Vínculo Regional", "Aptidão Documental"],
    link: "/pessoas",
  },
  {
    id: "contratos",
    icone: "📄",
    titulo: "Gestão de Contratos e Vigor",
    descricao:
      "Emissão automática de minutas em PDF com valores por extenso calculados no servidor, controle de vigência e formalização de distratos.",
    destaques: ["Extenso Gramatical", "Assinatura Eletrônica", "Controle de Vigência"],
    link: "/contratos",
  },
  {
    id: "documentos",
    icone: "🔍",
    titulo: "Conferência Documental",
    descricao:
      "Inspeção técnica em tempo real de fotos e comprovantes. Rejeição imediata de arquivos ilegíveis com menor dimensão inferior a 800 px.",
    destaques: ["Validação de 800+ px", "Hash SHA-256", "Buckets Privados (15 min)"],
    link: "/documentos",
  },
  {
    id: "atividades",
    icone: "📌",
    titulo: "Atividades de Rua e Prestação",
    descricao:
      "Registro de ações de rua, panfletagem e mobilizações com sincronização em tempo real e relatórios consolidados para prestação de contas.",
    destaques: ["Apontamento por Região", "Controle de Materiais", "Exportação TSE"],
    link: "/configuracoes?aba=atividades",
  },
];

const etapasFluxo = [
  {
    passo: "01",
    titulo: "Coleta Móvel em Campo",
    descricao:
      "O colaborador acessa um link individual ou QR Code diretamente pelo celular, preenche os dados e envia as fotos dos documentos sem necessidade de login ou download de aplicativo.",
  },
  {
    passo: "02",
    titulo: "Validação e Formalização",
    descricao:
      "O sistema inspeciona a resolução dos arquivos em tempo de upload, valida os dados cadastrais e gera a minuta contratual padronizada com assinatura digital.",
  },
  {
    passo: "03",
    titulo: "Gestão e Auditoria Centralizada",
    descricao:
      "O gestor acompanha o andamento em tempo real, gerencia pendências por região e mantém uma trilha auditável imutável com carimbo de tempo, IP e hash.",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-canvas text-ink selection:bg-primary-tint selection:text-primary font-sans">
      {/* 1. NAVEGAÇÃO SUPERIOR CLEAN */}
      <header className="sticky top-0 z-50 border-b border-line bg-surface/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Marca subtitulo="Sistema de Gestão" />
          </div>

          <nav className="hidden md:flex items-center gap-8 text-xs font-semibold tracking-wide text-ink-muted">
            <Link href="#modulos" className="hover:text-primary transition-colors">
              Módulos
            </Link>
            <Link href="#fluxo" className="hover:text-primary transition-colors">
              Como Funciona
            </Link>
            <Link href="/coleta/demonstracao" className="hover:text-primary transition-colors">
              Coleta Móvel
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <SeletorTema />
            <Link
              href="/login"
              className="bg-primary hover:bg-primary-hover text-white px-5 py-2 text-xs font-semibold flex items-center shadow-sm rounded-full transition"
            >
              <span>Acessar Painel</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-12 sm:py-16 space-y-24">
        {/* 2. HERO RESPIRÁVEL & SNAPSHOT GERENCIAL */}
        <section className="space-y-12">
          <div className="max-w-3xl space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary-tint px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-primary">
              <span>PLATAFORMA OPERACIONAL</span>
              <span className="text-primary/40">•</span>
              <span>CONFORMIDADE ELEITORAL</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-ink-strong leading-tight">
              Central de comando para equipes, contratos e conformidade.
            </h1>

            <p className="text-base sm:text-lg text-ink-muted leading-relaxed max-w-2xl font-normal">
              O Comitê Digital centraliza o cadastro de colaboradores em campo, a emissão automatizada
              de contratos e a conferência de documentos com rastreabilidade completa para a
              prestação de contas.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Link
                href="/login"
                className="bg-primary hover:bg-primary-hover text-white px-6 py-3.5 text-xs sm:text-sm font-semibold flex items-center rounded-full shadow-card transition"
              >
                <span>Entrar no Painel do Gestor</span>
              </Link>

              <Link
                href="/coleta/demonstracao"
                className="rounded-full border border-line bg-surface px-6 py-3.5 text-xs sm:text-sm font-semibold text-ink hover:bg-surface-sunken transition shadow-sm"
              >
                Experimentar Coleta Móvel
              </Link>
            </div>
          </div>

          {/* Snapshot Executivo em 4 Métricas Chave */}
          <div className="rounded-2xl border border-line bg-surface p-6 sm:p-8 shadow-card">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-5 mb-6">
              <div>
                <span className="text-xs font-mono uppercase tracking-wider text-ink-muted block">
                  Visão Operacional Consolidada
                </span>
                <span className="text-sm font-bold text-ink">
                  Demonstração da Central de Comando
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-positive-text animate-pulse" />
                <span className="text-xs font-mono text-positive-text font-medium">
                  Sincronizado ao Vivo
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="space-y-1">
                <span className="text-xs font-mono text-ink-muted uppercase">Equipe Ativa</span>
                <div className="text-2xl sm:text-3xl font-black text-ink font-mono">148</div>
                <span className="text-[0.72rem] text-positive-text font-medium block">
                  ● 100% validados por CPF
                </span>
              </div>

              <div className="space-y-1">
                <span className="text-xs font-mono text-ink-muted uppercase">Contratos Emitidos</span>
                <div className="text-2xl sm:text-3xl font-black text-primary font-mono">142</div>
                <span className="text-[0.72rem] text-ink-muted font-medium block">
                  134 assinados digitalmente
                </span>
              </div>

              <div className="space-y-1">
                <span className="text-xs font-mono text-ink-muted uppercase">Validação de Fotos</span>
                <div className="text-2xl sm:text-3xl font-black text-positive-text font-mono">98.6%</div>
                <span className="text-[0.72rem] text-ink-muted font-medium block">
                  Fotos nítidas (800+ px)
                </span>
              </div>

              <div className="space-y-1">
                <span className="text-xs font-mono text-ink-muted uppercase">Auditoria TSE</span>
                <div className="text-2xl sm:text-3xl font-black text-ink font-mono">100%</div>
                <span className="text-[0.72rem] text-positive-text font-medium block">
                  Trilha imutável com SHA-256
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* 3. MÓDULOS DO SISTEMA (APRESENTAÇÃO DIRETA DO PRODUTO) */}
        <section id="modulos" className="space-y-8 scroll-mt-24">
          <div className="max-w-2xl space-y-2">
            <span className="font-mono text-xs uppercase tracking-wider text-primary font-bold">
              Estrutura Funcional
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-ink-strong tracking-tight">
              Módulos do Sistema
            </h2>
            <p className="text-xs sm:text-sm text-ink-muted leading-relaxed">
              Tudo o que o gestor precisa para conduzir a operação com precisão, agilidade e total
              conformidade jurídica.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {modulos.map((mod) => (
              <div
                key={mod.id}
                className="rounded-2xl border border-line bg-surface p-6 sm:p-7 space-y-5 flex flex-col justify-between hover:border-primary/40 shadow-sm hover:shadow-card transition-all"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-tint border border-primary/20 text-lg">
                      {mod.icone}
                    </span>
                    <Link
                      href={mod.link}
                      className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                    >
                      <span>Abrir módulo</span>
                      <span>→</span>
                    </Link>
                  </div>

                  <h3 className="text-lg font-bold text-ink tracking-tight">{mod.titulo}</h3>

                  <p className="text-xs sm:text-sm text-ink-muted leading-relaxed font-normal">
                    {mod.descricao}
                  </p>
                </div>

                <div className="pt-3 border-t border-line flex flex-wrap gap-2">
                  {mod.destaques.map((item, idx) => (
                    <span
                      key={idx}
                      className="rounded-md border border-line bg-surface-sunken px-2.5 py-1 font-mono text-[0.68rem] text-ink-muted"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 4. COMO FUNCIONA NA PRÁTICA (FLUXO EM 3 ETAPAS) */}
        <section id="fluxo" className="space-y-8 scroll-mt-24">
          <div className="max-w-2xl space-y-2">
            <span className="font-mono text-xs uppercase tracking-wider text-primary font-bold">
              Processo Operacional
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-ink-strong tracking-tight">
              Como funciona na prática
            </h2>
            <p className="text-xs sm:text-sm text-ink-muted leading-relaxed">
              Da captação no celular do colaborador à consolidação no painel executivo.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {etapasFluxo.map((item, idx) => (
              <div
                key={idx}
                className="rounded-2xl border border-line bg-surface p-6 space-y-4 flex flex-col justify-between shadow-sm"
              >
                <div className="space-y-3">
                  <span className="font-mono text-xs font-bold text-primary bg-primary-tint px-2.5 py-1 rounded-full border border-primary/20 inline-block">
                    Etapa {item.passo}
                  </span>
                  <h3 className="text-base font-bold text-ink">{item.titulo}</h3>
                  <p className="text-xs sm:text-sm text-ink-muted leading-relaxed">
                    {item.descricao}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Chamada para teste móvel */}
          <div className="rounded-2xl border border-line bg-surface-sunken p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h4 className="text-sm sm:text-base font-bold text-ink">
                Coleta móvel sem atrito para o colaborador
              </h4>
              <p className="text-xs text-ink-muted max-w-xl">
                O colaborador não precisa baixar aplicativo nem criar senha. A validação do documento
                acontece no próprio navegador.
              </p>
            </div>
            <Link
              href="/inscricao/candidado-eleicao-2026"
              className="bg-primary hover:bg-primary-hover text-white px-5 py-2.5 text-xs font-semibold rounded-full whitespace-nowrap shadow-sm transition"
            >
              Testar Coleta Pública →
            </Link>
          </div>
        </section>

        {/* 5. ENCERRAMENTO EXECUTIVO */}
        <section className="rounded-3xl border border-primary/20 bg-surface-tint p-8 sm:p-12 text-center space-y-6 shadow-card">
          <div className="max-w-xl mx-auto space-y-3">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-ink-strong tracking-tight">
              Sua campanha organizada, auditável e sob controle.
            </h2>
            <p className="text-xs sm:text-sm text-ink-muted leading-relaxed">
              Deixe de depender de controles paralelos e planilhas desconexas. Tenha visibilidade em
              tempo real de cada colaborador, contrato e atividade.
            </p>
          </div>

          <div className="pt-2">
            <Link
              href="/login"
              className="bg-primary hover:bg-primary-hover text-white px-8 py-3.5 text-xs sm:text-sm font-bold rounded-full inline-flex items-center gap-2 shadow-sm transition"
            >
              <span>Acessar o Painel do Gestor</span>
              <span className="text-base">→</span>
            </Link>
          </div>
        </section>
      </main>

      {/* 6. RODAPÉ INSTITUCIONAL MINIMALISTA */}
      <footer className="border-t border-line bg-surface-sunken py-10 px-6 sm:px-12 text-ink-muted text-xs">
        <div className="mx-auto max-w-6xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 border-b border-line pb-8">
          <div className="space-y-1">
            <Marca subtitulo="Sistema de Gestão" />
            <p className="text-ink-muted text-xs max-w-sm pt-1">
              Plataforma de gestão operacional e conformidade para campanhas eleitorais.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-xs font-semibold text-ink-muted">
            <Link href="#modulos" className="hover:text-primary transition-colors">
              Módulos
            </Link>
            <Link href="#fluxo" className="hover:text-primary transition-colors">
              Como Funciona
            </Link>
            <Link href="/coleta/demonstracao" className="hover:text-primary transition-colors">
              Coleta Móvel
            </Link>
            <Link href="/login" className="text-primary hover:underline">
              Painel do Gestor
            </Link>
          </div>
        </div>

        <div className="mx-auto max-w-6xl pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-[0.7rem] text-ink-subtle font-mono">
          <span>COMITÊ DIGITAL © 2026 · TODOS OS DIREITOS RESERVADOS.</span>
          <div className="flex items-center gap-2 text-ink-muted">
            <span>Desenvolvido por:</span>
            <a
              href="https://waldoeller.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-ink hover:text-primary transition-colors underline decoration-primary/40 underline-offset-4"
            >
              Waldo Eller
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
