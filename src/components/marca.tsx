/**
 * Marca oficial da campanha Comitê Digital 2026.
 * Incorpora o padrão tipográfico bold da referência visual (verde bandeira, amarelo ouro e branco).
 */
export function Marca({
  className = "",
  subtitulo = "Sistema de Gestão",
  mostrarEmblema = true,
}: {
  className?: string;
  subtitulo?: string;
  mostrarEmblema?: boolean;
}) {
  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      {mostrarEmblema && (
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-green shadow-xs ring-1 ring-white/20 shrink-0">
          <span className="h-3 w-3 rotate-45 bg-brand-yellow flex items-center justify-center">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-blue" />
          </span>
        </span>
      )}
      <div className="flex flex-col leading-none">
        <div className="flex items-baseline gap-1 tracking-tight">
          <span className="font-extrabold uppercase tracking-tight text-current">
            Comitê<span className="text-brand-yellow ml-0.5">Digital</span>
          </span>
          <span className="rounded bg-brand-yellow/20 px-1 py-0.5 text-[0.65rem] font-mono font-bold text-brand-yellow ring-1 ring-brand-yellow/40">
            2026
          </span>
        </div>
        {subtitulo && (
          <span className="text-[0.65rem] font-mono uppercase tracking-widest opacity-60 mt-0.5">
            {subtitulo}
          </span>
        )}
      </div>
    </div>
  );
}
