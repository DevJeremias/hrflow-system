import React from 'react';
import { RefreshCw } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import Button from './ui/Button';

// O service worker novo espera: atualizar sem avisar trocaria o app no meio de um formulário
// aberto. A pessoa escolhe quando recarregar.
const AvisoDeAtualizacao: React.FC = () => {
  const { needRefresh: [novaVersao], updateServiceWorker } = useRegisterSW();

  if (!novaVersao) return null;

  return (
    <div data-modal-ignore role="status" className="fixed inset-x-4 bottom-4 z-[60] mx-auto flex max-w-md items-center justify-between gap-4 rounded-card bg-surface-inverse p-4 text-sm font-semibold text-white shadow-modal">
      <span className="flex items-center gap-2"><RefreshCw size={18} aria-hidden="true" /> Há uma nova versão do HRFlow.</span>
      <Button size="sm" onClick={() => updateServiceWorker(true)}>Atualizar</Button>
    </div>
  );
};

export default AvisoDeAtualizacao;
