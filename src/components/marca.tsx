/**
 * Marca oficial Comitê Digital 2026.
 * Fonte única da identidade visual: cd (ligadura verde green-500) + • (accent lime-400)
 * + wordmark "comitê" (ink) / "digital" (ink-muted) conforme docs/DESIGN-SYSTEM.md (§7.9).
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
    <div className={`inline-flex items-center gap-1.5 ${className}`}>
      {mostrarEmblema && (
        <span className="inline-flex items-center select-none tracking-tighter font-black text-xl leading-none shrink-0 mr-0.5">
          <span className="text-primary-base">cd</span>
          <span className="h-2.5 w-2.5 rounded-full bg-accent ml-1.5 inline-block shrink-0" />
        </span>
      )}
      <div className="flex flex-col leading-none">
        <div className="flex items-baseline gap-1.5 tracking-tight">
          <span className="font-extrabold tracking-tight text-ink text-base">
            comitê<span className="text-ink-muted font-normal ml-0.5">digital</span>
          </span>
          <span className="rounded-full bg-primary-tint px-1.5 py-0.5 text-[0.62rem] font-mono font-bold text-primary">
            2026
          </span>
        </div>
        {subtitulo && (
          <span className="text-[0.65rem] font-mono tracking-wider text-ink-muted mt-0.5">
            {subtitulo}
          </span>
        )}
      </div>
    </div>
  );
}
