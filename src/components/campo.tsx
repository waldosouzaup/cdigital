import type {
  InputHTMLAttributes,
  ReactNode,
  Ref,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

/**
 * Campo de formulário institucional (§7.2 do DESIGN-SYSTEM.md).
 * Fundo surface, bordas em line, foco em primary com anel sutil, erro em danger.
 */
type BaseProps = {
  rotulo: string;
  id: string;
  auxiliar?: ReactNode;
  erro?: string | null;
  className?: string;
};

type CampoInputProps = InputHTMLAttributes<HTMLInputElement> &
  BaseProps & {
    mono?: boolean;
    icone?: ReactNode;
    ref?: Ref<HTMLInputElement>;
  };

export function Campo({
  rotulo,
  id,
  mono = false,
  auxiliar,
  erro,
  icone,
  className = "",
  ref,
  ...props
}: CampoInputProps) {
  return (
    <div className="w-full">
      <label htmlFor={id} className="block text-small font-medium text-ink">
        {rotulo}
      </label>
      <div className="relative mt-1.5 flex items-center">
        {icone && <span className="absolute left-3 text-ink-muted/70">{icone}</span>}
        <input
          ref={ref}
          id={id}
          aria-invalid={Boolean(erro)}
          aria-describedby={erro ? `${id}-erro` : auxiliar ? `${id}-aux` : undefined}
          className={`w-full rounded-md border bg-surface px-3 py-2 text-ink outline-none transition-all placeholder:text-ink-subtle focus:border-primary focus:ring-1 focus:ring-focus text-small ${
            erro ? "border-danger ring-1 ring-danger" : "border-line"
          } ${mono ? "font-mono" : ""} ${icone ? "pl-9" : ""} ${className}`}
          {...props}
        />
      </div>
      {erro ? (
        <p id={`${id}-erro`} role="alert" className="mt-1.5 text-xs text-danger font-medium">
          {erro}
        </p>
      ) : auxiliar ? (
        <div id={`${id}-aux`} className="mt-1.5 text-xs text-ink-muted leading-relaxed">
          {auxiliar}
        </div>
      ) : null}
    </div>
  );
}

function Area({
  rotulo,
  id,
  auxiliar,
  erro,
  className = "",
  rows = 3,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & BaseProps) {
  return (
    <div className="w-full">
      <label htmlFor={id} className="block text-small font-medium text-ink">
        {rotulo}
      </label>
      <textarea
        id={id}
        rows={rows}
        aria-invalid={Boolean(erro)}
        className={`mt-1.5 w-full rounded-md border bg-surface p-3 text-ink outline-none transition-all placeholder:text-ink-subtle focus:border-primary focus:ring-1 focus:ring-focus text-small leading-relaxed ${
          erro ? "border-danger ring-1 ring-danger" : "border-line"
        } ${className}`}
        {...props}
      />
      {erro ? (
        <p role="alert" className="mt-1.5 text-xs text-danger font-medium">
          {erro}
        </p>
      ) : auxiliar ? (
        <div className="mt-1.5 text-xs text-ink-muted leading-relaxed">{auxiliar}</div>
      ) : null}
    </div>
  );
}

function Selecao({
  rotulo,
  id,
  auxiliar,
  erro,
  className = "",
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & BaseProps) {
  return (
    <div className="w-full">
      <label htmlFor={id} className="block text-small font-medium text-ink">
        {rotulo}
      </label>
      <select
        id={id}
        aria-invalid={Boolean(erro)}
        className={`mt-1.5 w-full rounded-md border bg-surface px-3 py-2 text-ink outline-none transition-all focus:border-primary focus:ring-1 focus:ring-focus text-small cursor-pointer ${
          erro ? "border-danger ring-1 ring-danger" : "border-line"
        } ${className}`}
        {...props}
      >
        {children}
      </select>
      {erro ? (
        <p role="alert" className="mt-1.5 text-xs text-danger font-medium">
          {erro}
        </p>
      ) : auxiliar ? (
        <div className="mt-1.5 text-xs text-ink-muted leading-relaxed">{auxiliar}</div>
      ) : null}
    </div>
  );
}

Campo.Area = Area;
Campo.Selecao = Selecao;
