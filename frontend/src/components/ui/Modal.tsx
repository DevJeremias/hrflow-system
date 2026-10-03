import React, { useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { IconButton } from './Button';

const TAMANHOS = { sm: 'max-w-md', md: 'max-w-2xl', lg: 'max-w-3xl' } as const;

// Quem abre vários modais em sequência não pode soltar o fundo antes do último fechar: conta quantos o seguram.
const seguradores = new WeakMap<Element, number>();
let travasDeRolagem = 0;
let rolagemOriginal = '';

const travar = (portal: HTMLElement) => {
  const irmaos = [...document.body.children].filter((el) => el !== portal && !el.hasAttribute('data-modal-ignore') && !['SCRIPT', 'STYLE', 'LINK'].includes(el.tagName));
  for (const el of irmaos) {
    const total = (seguradores.get(el) ?? 0) + 1;
    seguradores.set(el, total);
    if (total === 1) el.setAttribute('inert', '');
  }
  if (travasDeRolagem++ === 0) {
    rolagemOriginal = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  return () => {
    for (const el of irmaos) {
      const total = (seguradores.get(el) ?? 1) - 1;
      seguradores.set(el, total);
      if (total === 0) el.removeAttribute('inert');
    }
    if (--travasDeRolagem === 0) document.body.style.overflow = rolagemOriginal;
  };
};

interface ModalProps {
  title: string;
  description?: React.ReactNode;
  // Esc, clique no fundo e o X chamam isto; quem precisa de confirmação antes de descartar decide aqui.
  onClose: () => void;
  size?: keyof typeof TAMANHOS;
  footer?: React.ReactNode;
  headerActions?: React.ReactNode;
  closeOnBackdrop?: boolean;
  // Classes do contêiner anexado ao <body>: o holerite o usa para o CSS de impressão.
  portalClassName?: string;
  className?: string;
  // Substitui o espaçamento padrão do corpo.
  bodyClassName?: string;
  // Com `form`, corpo e rodapé ficam dentro do <form>: os botões de envio do rodapé continuam dentro dele.
  form?: { onSubmit: React.FormEventHandler<HTMLFormElement> };
  children?: React.ReactNode;
}

// O modal existe enquanto está montado: quem o usa o renderiza condicionalmente. Ele vai para um contêiner no <body>,
// deixa o restante da página inerte (foco e leitor de tela) e devolve o foco a quem o abriu ao desmontar.
const Modal: React.FC<ModalProps> = ({ title, description, onClose, size = 'md', footer, headerActions, closeOnBackdrop = true, portalClassName = '', className = '', bodyClassName = 'px-5 py-5 sm:px-8 sm:py-6', form, children }) => {
  const idTitulo = useId();
  const idDescricao = useId();
  // O contêiner nasce no primeiro render e só entra no <body> no efeito: o React não toca no DOM durante o render.
  const [portal] = useState(() => document.createElement('div'));
  const dialogo = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    portal.setAttribute('class', portalClassName);
    portal.setAttribute('data-modal-root', '');
    document.body.append(portal);
    const soltar = travar(portal);
    return () => {
      soltar();
      portal.remove();
    };
  }, [portal, portalClassName]);

  useFocusTrap(dialogo, { onEscape: onClose });

  const conteudo = (
    <>
      {children != null && <div className={`min-h-0 flex-1 overflow-y-auto print:overflow-visible ${bodyClassName}`}>{children}</div>}
      {footer && <div className="border-t border-line px-5 py-4 sm:px-8 print:hidden">{footer}</div>}
    </>
  );

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 print:static print:block print:p-0">
      <div data-modal-backdrop aria-hidden="true" onClick={closeOnBackdrop ? onClose : undefined} className="absolute inset-0 bg-ink/60 backdrop-blur-sm animate-in fade-in duration-200 print:hidden" />
      <div
        ref={dialogo}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        aria-describedby={description ? idDescricao : undefined}
        tabIndex={-1}
        className={`relative flex max-h-[calc(100dvh-2rem)] w-full ${TAMANHOS[size]} animate-in zoom-in-95 fade-in flex-col overflow-hidden rounded-modal bg-surface shadow-modal duration-200 print:max-h-none print:max-w-none print:rounded-none print:shadow-none ${className}`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-8 sm:py-5 print:hidden">
          <div className="min-w-0">
            <h2 id={idTitulo} className="text-xl font-bold tracking-tight text-ink">{title}</h2>
            {description && <p id={idDescricao} className="mt-1 text-sm text-ink-muted">{description}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {headerActions}
            <IconButton label="Fechar" onClick={onClose} data-fechar><X size={20} aria-hidden="true" /></IconButton>
          </div>
        </div>
        {form ? (
          <form onSubmit={form.onSubmit} className="flex min-h-0 flex-1 flex-col">{conteudo}</form>
        ) : conteudo}
      </div>
    </div>,
    portal,
  );
};

export default Modal;
