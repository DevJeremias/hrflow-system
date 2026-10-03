import React, { useCallback, useRef, useState } from 'react';
import ConfirmDialog, { type ConfirmOptions } from './ConfirmDialog';
import { ConfirmContext, type Confirmar } from './confirmContext';

const ConfirmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [pergunta, setPergunta] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((resposta: boolean) => void) | null>(null);

  const confirmar = useCallback<Confirmar>((opcoes) => new Promise<boolean>((resolve) => {
    // Uma pergunta nova fecha a anterior como "não": nenhuma promessa fica pendente.
    resolver.current?.(false);
    resolver.current = resolve;
    setPergunta(opcoes);
  }), []);

  const responder = (resposta: boolean) => {
    resolver.current?.(resposta);
    resolver.current = null;
    setPergunta(null);
  };

  return (
    <ConfirmContext.Provider value={confirmar}>
      {children}
      {pergunta && <ConfirmDialog {...pergunta} onConfirm={() => responder(true)} onCancel={() => responder(false)} />}
    </ConfirmContext.Provider>
  );
};

export default ConfirmProvider;
