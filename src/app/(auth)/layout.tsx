/**
 * Casca visual das telas de autenticação (login, verificação, MFA) — Tarefa 8.
 *
 * Split assimétrico: painel institucional à esquerda (oculto abaixo de 360px úteis,
 * já que a skill front-end-design pede atenção ao contexto de campo no celular) +
 * formulário à direita, sem cartão nem sombra — delimitado por um hairline, como um
 * formulário em papel timbrado.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="flex flex-col justify-between border-line bg-ink px-8 py-10 text-paper md:w-[38%] md:border-r md:px-12 md:py-16">
        <div>
          <p className="text-sm tracking-tight text-paper/70">Comitê Digital</p>
        </div>
        <div className="hidden md:block">
          <p className="max-w-xs text-2xl leading-snug font-medium text-balance">
            Cada pessoa, cada contrato, cada documento — um só lugar, nunca um nome de arquivo.
          </p>
          <p className="mt-6 max-w-xs text-sm leading-relaxed text-paper/60">
            Gestão de equipe temporária e prestação de contas para comitês de campanha.
          </p>
        </div>
        <p className="hidden text-xs text-paper/40 md:block">
          Acesso restrito à equipe autorizada.
        </p>
      </aside>

      <main className="flex flex-1 items-center px-6 py-12 md:px-16">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
