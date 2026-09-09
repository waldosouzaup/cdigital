import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

/**
 * Campo de formulário no estilo "papel timbrado".
 *
 * Rótulo institucional acima, entrada sublinhada por um hairline que reage ao foco
 * com a cor de selo, ou alerta em caso de erro.
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
  };

export function Campo({
  rotulo,
  id,
  mono = false,
  auxiliar,
  erro,
  icone,
  className = "",
  ...props
}: CampoInputProps) {
  return (
    <div className="w-full">
      <label htmlFor={id} className="block text-small font-medium text-ink">
        {rotulo}
      </label>
      <div className="relative mt-1.5 flex items-center">
        {icone && <span className="absolute left-0 text-ink-muted/70">{icone}</span>}
        <input
          id={id}
          aria-invalid={Boolean(erro)}
          aria-describedby={erro ? `${id}-erro` : auxiliar ? `${id}-aux` : undefined}
          className={`w-full border-b bg-transparent py-2 text-ink outline-none transition-colors placeholder:text-ink-muted/50 focus:border-seal ${
            erro ? "border-alert" : "border-line"
          } ${mono ? "font-mono" : ""} ${icone ? "pl-6" : ""} ${className}`}
          {...props}
        />
      </div>
      {erro ? (
        <p id={`${id}-erro`} role="alert" className="mt-1.5 text-xs text-alert">
          {erro}
        </p>
      ) : auxiliar ? (
        <div id={`${id}-aux`} className="mt-1.5 text-xs text-ink-muted">
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
        className={`mt-1.5 w-full border bg-transparent p-2.5 text-ink outline-none transition-colors placeholder:text-ink-muted/50 focus:border-seal text-small leading-relaxed ${
          erro ? "border-alert" : "border-line"
        } ${className}`}
        {...props}
      />
      {erro ? (
        <p role="alert" className="mt-1.5 text-xs text-alert">
          {erro}
        </p>
      ) : auxiliar ? (
        <div className="mt-1.5 text-xs text-ink-muted">{auxiliar}</div>
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
        className={`mt-1.5 w-full border-b bg-transparent py-2 text-ink outline-none transition-colors focus:border-seal text-small cursor-pointer ${
          erro ? "border-alert" : "border-line"
        } ${className}`}
        {...props}
      >
        {children}
      </select>
      {erro ? (
        <p role="alert" className="mt-1.5 text-xs text-alert">
          {erro}
        </p>
      ) : auxiliar ? (
        <div className="mt-1.5 text-xs text-ink-muted">{auxiliar}</div>
      ) : null}
    </div>
  );
}

Campo.Area = Area;
Campo.Selecao = Selecao;
