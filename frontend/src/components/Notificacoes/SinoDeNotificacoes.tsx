import React, { useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import { useMarcarNotificacaoLida, useMarcarTodasLidas, useNotificacoes } from '../../queries/notificacoes';
import type { Notification } from '../../services/notificacoesService';
import { IconButton } from '../ui/Button';
import Button from '../ui/Button';
import Skeleton from '../ui/Skeleton';
import { useFusoDaEmpresa } from '../../hooks/useFusoDaEmpresa';
import { formatarMomento } from '../../utils/competencia';
import { rotuloDoSino } from '../../utils/notificacoes';

const SELO_MAXIMO = 9;

// O sino do cabeçalho: o selo conta o que ainda não foi lido e o painel lista os avisos mais recentes.
// Painel de divulgação (botão com aria-expanded), não um diálogo: não prende o foco, fecha com Esc ou
// com um clique fora e devolve o foco ao botão.
const SinoDeNotificacoes: React.FC = () => {
  const [aberto, setAberto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const idDoPainel = useId();
  const navigate = useNavigate();
  const fuso = useFusoDaEmpresa();
  const { data, isPending, isError, refetch } = useNotificacoes();
  const marcarLida = useMarcarNotificacaoLida();
  const marcarTodas = useMarcarTodasLidas();
  const naoLidas = data?.naoLidas ?? 0;

  useEffect(() => {
    if (!aberto) return undefined;
    const aoClicarFora = (evento: MouseEvent) => {
      if (raiz.current && !raiz.current.contains(evento.target as Node)) setAberto(false);
    };
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key !== 'Escape') return;
      setAberto(false);
      botao.current?.focus();
    };
    document.addEventListener('mousedown', aoClicarFora);
    document.addEventListener('keydown', aoTeclar);
    return () => {
      document.removeEventListener('mousedown', aoClicarFora);
      document.removeEventListener('keydown', aoTeclar);
    };
  }, [aberto]);

  const abrirAviso = (aviso: Notification) => {
    if (!aviso.lida) marcarLida.mutate(aviso.id);
    setAberto(false);
    if (aviso.link) navigate(aviso.link);
  };

  return (
    <div ref={raiz} className="relative">
      <IconButton
        ref={botao}
        label={rotuloDoSino(naoLidas)}
        aria-expanded={aberto}
        aria-controls={aberto ? idDoPainel : undefined}
        onClick={() => setAberto((atual) => !atual)}
        className="relative"
      >
        <Bell size={22} aria-hidden="true" />
        {naoLidas > 0 && (
          <span aria-hidden="true" className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-xs font-bold text-white">
            {naoLidas > SELO_MAXIMO ? `${SELO_MAXIMO}+` : naoLidas}
          </span>
        )}
      </IconButton>

      {aberto && (
        <section
          id={idDoPainel}
          aria-label="Notificações"
          className="fixed inset-x-4 top-[4.5rem] z-30 max-h-[70vh] overflow-y-auto rounded-card border border-line bg-surface shadow-modal sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96"
        >
          <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
            <h2 className="text-base font-bold text-ink">Notificações</h2>
            {naoLidas > 0 && (
              <Button variant="link" size="sm" icon={<CheckCheck size={16} aria-hidden="true" />} loading={marcarTodas.isPending} onClick={() => marcarTodas.mutate()}>
                Marcar todas como lidas
              </Button>
            )}
          </div>

          {isPending ? (
            <div className="space-y-3 p-4" aria-busy="true">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-full" />
            </div>
          ) : isError ? (
            <div role="alert" className="space-y-2 p-4 text-sm font-semibold text-danger">
              <p>Não foi possível carregar as notificações.</p>
              <Button variant="link" size="sm" onClick={() => { void refetch(); }}>Tentar novamente</Button>
            </div>
          ) : data.itens.length === 0 ? (
            <p className="p-6 text-center text-sm text-ink-muted">Nenhuma notificação por enquanto.</p>
          ) : (
            <ul className="divide-y divide-line">
              {data.itens.map((aviso) => (
                <li key={aviso.id}>
                  <button
                    type="button"
                    onClick={() => abrirAviso(aviso)}
                    className={`flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors hover:bg-surface-sunken ${aviso.lida ? '' : 'bg-brand-soft/40'}`}
                  >
                    <span className="flex items-start justify-between gap-3">
                      <span className={`text-sm text-ink ${aviso.lida ? 'font-medium' : 'font-bold'}`}>{aviso.titulo}</span>
                      {!aviso.lida && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand" role="img" aria-label="Não lida" />}
                    </span>
                    <span className="text-sm text-ink-muted">{aviso.mensagem}</span>
                    <span className="text-xs text-ink-muted">{formatarMomento(aviso.criadaEm, fuso)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
};

export default SinoDeNotificacoes;
