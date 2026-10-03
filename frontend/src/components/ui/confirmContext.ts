import { createContext, useContext } from 'react';
import type { ConfirmOptions } from './ConfirmDialog';

export type Confirmar = (opcoes: ConfirmOptions) => Promise<boolean>;

export const ConfirmContext = createContext<Confirmar | null>(null);

// Substitui a pergunta nativa do navegador: `if (await confirmar({ title, ... })) { ... }`.
export const useConfirm = (): Confirmar => {
  const confirmar = useContext(ConfirmContext);
  if (!confirmar) throw new Error('useConfirm precisa estar dentro de <ConfirmProvider>.');
  return confirmar;
};
