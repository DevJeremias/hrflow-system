import { createContext, useContext } from 'react';

export type TipoDeToast = 'success' | 'error' | 'info';

export interface Notificar {
  success: (mensagem: string) => void;
  error: (mensagem: string) => void;
  info: (mensagem: string) => void;
}

export const ToastContext = createContext<Notificar | null>(null);

// Feedback de uma ação já concluída ou que falhou fora de um formulário: `toast.success('Colaborador salvo.')`.
export const useToast = (): Notificar => {
  const notificar = useContext(ToastContext);
  if (!notificar) throw new Error('useToast precisa estar dentro de <ToastProvider>.');
  return notificar;
};
