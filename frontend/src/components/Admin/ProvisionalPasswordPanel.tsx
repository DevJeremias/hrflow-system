import React, { useState } from 'react';
import { Copy, Check, KeyRound } from 'lucide-react';
import Button from '../ui/Button';

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
    <div role="status" className="space-y-4 rounded-card border border-warning-line bg-warning-soft p-5 animate-in fade-in duration-200 sm:p-6">
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="shrink-0 rounded-control bg-surface p-2.5 text-warning"><KeyRound size={20} /></span>
        <div className="min-w-0">
          <p className="font-bold text-ink">Senha provisória de {nome}</p>
          <p className="break-words text-sm text-ink-muted">
            Entregue a senha a <span className="break-all">{email}</span>. Ela não aparece de novo e deve ser trocada no primeiro acesso.
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <code data-testid="senha-provisoria" className="flex-1 select-all break-all rounded-control border border-warning-line bg-surface px-4 py-3 text-lg font-bold tracking-widest text-ink">{senha}</code>
        <Button onClick={copiar} icon={copiada ? <Check size={18} aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />}>
          {copiada ? 'Copiada' : 'Copiar'}
        </Button>
      </div>
      <Button variant="link" className="text-sm text-ink-muted hover:text-ink" onClick={onClose}>Já entreguei, fechar</Button>
    </div>
  );
};

export default ProvisionalPasswordPanel;
