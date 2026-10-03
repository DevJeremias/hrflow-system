import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { IconButton } from './Button';
import { ToastContext, type Notificar, type TipoDeToast } from './toastContext';

interface Toast {
  id: number;
  tipo: TipoDeToast;
  mensagem: string;
}

// Erro fica mais tempo: quem leu errado não tem como voltar a uma notificação que sumiu.
const DURACAO_MS: Record<TipoDeToast, number> = { success: 5000, info: 5000, error: 9000 };

const VISUAL = {
  success: { classes: 'border-success-line bg-success-soft text-success', icone: <CheckCircle2 size={20} aria-hidden="true" /> },
  info: { classes: 'border-info-line bg-info-soft text-info', icone: <Info size={20} aria-hidden="true" /> },
  error: { classes: 'border-danger-line bg-danger-soft text-danger', icone: <AlertCircle size={20} aria-hidden="true" /> },
} as const;

const ItemDeToast: React.FC<{ toast: Toast; onFechar: (id: number) => void }> = ({ toast, onFechar }) => {
  const { id, tipo, mensagem } = toast;
  useEffect(() => {
    const timer = setTimeout(() => onFechar(id), DURACAO_MS[tipo]);
    return () => clearTimeout(timer);
  }, [id, tipo, onFechar]);

  return (
    <div className={`pointer-events-auto flex items-start gap-3 rounded-card border p-4 shadow-raised animate-in slide-in-from-bottom-2 fade-in duration-200 ${VISUAL[tipo].classes}`}>
      <span className="mt-0.5 shrink-0">{VISUAL[tipo].icone}</span>
      <p className="flex-1 text-sm font-semibold">{mensagem}</p>
      <IconButton label="Fechar notificação" size="sm" onClick={() => onFechar(id)} className="-m-1 text-current hover:bg-black/5"><X size={16} aria-hidden="true" /></IconButton>
    </div>
  );
};

const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const proximoId = useRef(0);

  const fechar = useCallback((id: number) => setToasts((atuais) => atuais.filter((toast) => toast.id !== id)), []);
  const notificar = useMemo<Notificar>(() => {
    const abrir = (tipo: TipoDeToast) => (mensagem: string) => setToasts((atuais) => [...atuais, { id: ++proximoId.current, tipo, mensagem }]);
    return { success: abrir('success'), error: abrir('error'), info: abrir('info') };
  }, []);

  return (
    <ToastContext.Provider value={notificar}>
      {children}
      {/* As regiões vivas existem desde o início: o leitor de tela só anuncia o que entra em uma região já presente. */}
      <div data-modal-ignore className="pointer-events-none fixed inset-x-4 bottom-4 z-[60] flex flex-col items-end gap-3 sm:left-auto sm:w-full sm:max-w-sm">
        <div role="status" className="flex w-full flex-col gap-3">
          {toasts.filter((toast) => toast.tipo !== 'error').map((toast) => <ItemDeToast key={toast.id} toast={toast} onFechar={fechar} />)}
        </div>
        <div role="alert" className="flex w-full flex-col gap-3">
          {toasts.filter((toast) => toast.tipo === 'error').map((toast) => <ItemDeToast key={toast.id} toast={toast} onFechar={fechar} />)}
        </div>
      </div>
    </ToastContext.Provider>
  );
};

export default ToastProvider;
