import React, { useState } from 'react';
import { Copy, Check, KeyRound } from 'lucide-react';

interface Props {
  nome: string;
  email: string;
  senha: string;
  onClose: () => void;
}

// A senha provisória aparece uma única vez: o servidor guarda só o hash. Quem criou a conta a
// entrega à pessoa, que a troca no primeiro acesso.
const ProvisionalPasswordPanel: React.FC<Props> = ({ nome, email, senha, onClose }) => {
  const [copiada, setCopiada] = useState(false);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(senha);
      setCopiada(true);
    } catch {
      setCopiada(false);
    }
  };

  return (
    <div role="status" className="rounded-3xl border border-amber-200 bg-amber-50 p-6 space-y-4 animate-in fade-in duration-300">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-amber-100 p-2.5 text-amber-700 shrink-0"><KeyRound size={20} /></div>
        <div className="min-w-0">
          <p className="font-black text-slate-900">Senha provisória de {nome}</p>
          <p className="text-sm font-medium text-slate-600 break-words">
            Entregue a senha a {email}. Ela não aparece de novo e deve ser trocada no primeiro acesso.
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <code data-testid="senha-provisoria" className="flex-1 rounded-2xl border border-amber-200 bg-white px-4 py-3 text-lg font-black tracking-widest text-slate-900 select-all break-all">{senha}</code>
        <button type="button" onClick={copiar} className="flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 font-bold text-white hover:bg-primary transition-colors">
          {copiada ? <Check size={18} /> : <Copy size={18} />}
          <span>{copiada ? 'Copiada' : 'Copiar'}</span>
        </button>
      </div>
      <button type="button" onClick={onClose} className="text-sm font-bold text-slate-500 hover:text-slate-700 underline underline-offset-4">
        Já entreguei, fechar
      </button>
    </div>
  );
};

export default ProvisionalPasswordPanel;
