import React from 'react';
import { RefreshCw } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';

// O service worker novo espera: atualizar sem avisar trocaria o app no meio de um formulário
// aberto. A pessoa escolhe quando recarregar.
const AvisoDeAtualizacao: React.FC = () => {
  const { needRefresh: [novaVersao], updateServiceWorker } = useRegisterSW();

  if (!novaVersao) return null;

  return (
    <div role="status" className="fixed bottom-4 left-4 right-4 z-[60] mx-auto flex max-w-md items-center justify-between gap-4 rounded-2xl bg-slate-900 p-4 text-sm font-bold text-white shadow-2xl">
      <span className="flex items-center gap-2"><RefreshCw size={18} /> Há uma nova versão do HRFlow.</span>
      <button type="button" onClick={() => updateServiceWorker(true)} className="rounded-xl bg-primary px-4 py-2 font-black hover:opacity-90">
        Atualizar
      </button>
    </div>
  );
};

export default AvisoDeAtualizacao;
