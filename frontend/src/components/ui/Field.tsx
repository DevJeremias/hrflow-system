import React, { useId } from 'react';

const CONTROLE = 'w-full rounded-control border border-line-input bg-surface text-sm text-ink placeholder:text-ink-subtle disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-ink-muted aria-[invalid=true]:border-danger';

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & { icon?: React.ReactNode };

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ icon, className = '', ...resto }, ref) => {
  const campo = <input ref={ref} className={`${CONTROLE} h-11 ${icon ? 'pl-11' : 'px-4'} ${icon ? 'pr-4' : ''} ${className}`} {...resto} />;
  if (!icon) return campo;
  return (
    <div className="relative">
      <span aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-subtle">{icon}</span>
      {campo}
    </div>
  );
});
Input.displayName = 'Input';

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(({ className = '', ...resto }, ref) => (
  <select ref={ref} className={`${CONTROLE} h-11 cursor-pointer px-3 ${className}`} {...resto} />
));
Select.displayName = 'Select';

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className = '', ...resto }, ref) => (
  <textarea ref={ref} className={`${CONTROLE} px-4 py-3 ${className}`} {...resto} />
));
Textarea.displayName = 'Textarea';

interface FieldProps {
  label: string;
  // Obrigatório de propósito: gerenciador de senha, autofill e testes dependem do name.
  name: string;
  hint?: React.ReactNode;
  error?: string | null;
  required?: boolean;
  // O rótulo continua no DOM para o leitor de tela; só deixa de ser desenhado.
  hideLabel?: boolean;
  className?: string;
  children: React.ReactElement<Record<string, unknown>>;
}

// Dona do par rótulo e controle: o rótulo (label for) aponta para o id que ela injeta no campo, junto de name,
// required e as ligações aria da dica e do erro.
const Field: React.FC<FieldProps> = ({ label, name, hint, error, required, hideLabel, className = '', children }) => {
  const uid = useId().replace(/:/g, '');
  const id = `${name}-${uid}`;
  const idDica = hint ? `${id}-dica` : undefined;
  const idErro = error ? `${id}-erro` : undefined;
  const descricao = [idDica, idErro, children.props['aria-describedby']].filter(Boolean).join(' ') || undefined;

  return (
    <div className={`space-y-1.5 ${className}`}>
      <label htmlFor={id} className={hideLabel ? 'sr-only' : 'block text-sm font-semibold text-ink'}>
        {label}
        {required && <span aria-hidden="true" className="ml-0.5 text-danger">*</span>}
      </label>
      {React.cloneElement(children, { id, name, required: required || undefined, 'aria-invalid': error ? true : undefined, 'aria-describedby': descricao })}
      {hint && <p id={idDica} className="text-xs text-ink-muted">{hint}</p>}
      {error && <p id={idErro} className="text-xs font-semibold text-danger">{error}</p>}
    </div>
  );
};

export default Field;
