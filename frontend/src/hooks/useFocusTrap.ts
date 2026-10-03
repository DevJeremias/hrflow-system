import { useEffect, useRef, useState, type RefObject } from 'react';

const FOCAVEIS = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export const elementosFocaveis = (raiz: HTMLElement): HTMLElement[] =>
  [...raiz.querySelectorAll<HTMLElement>(FOCAVEIS)].filter((el) => !el.closest('[hidden], [inert]'));

// Só a camada mais recente (modal sobre modal) trata Tab e Esc.
const pilha: symbol[] = [];

interface Opcoes {
  ativo?: boolean;
  onEscape?: () => void;
  // Elemento que recebe o foco ao abrir; por padrão o marcado com data-autofocus ou o primeiro focável.
  foco?: () => HTMLElement | null;
  // Para onde o foco vai se quem abriu o diálogo saiu do DOM enquanto ele estava aberto.
  focoReserva?: string;
}

// Foco entra ao abrir, Tab circula dentro da raiz, Esc avisa e o foco volta a quem abriu.
export const useFocusTrap = (raiz: RefObject<HTMLElement | null>, { ativo = true, onEscape, foco, focoReserva = '#conteudo' }: Opcoes = {}) => {
  // Lido no primeiro render, antes de o diálogo mover o foco; um efeito dobrado pelo StrictMode já o veria dentro dele.
  const [origem] = useState(() => (document.activeElement === document.body ? null : (document.activeElement as HTMLElement | null)));
  const aoEscape = useRef(onEscape);
  const escolherFoco = useRef(foco);
  useEffect(() => {
    aoEscape.current = onEscape;
    escolherFoco.current = foco;
  });

  useEffect(() => {
    const elemento = raiz.current;
    if (!ativo || !elemento) return undefined;
    const id = Symbol('foco');
    pilha.push(id);

    const inicial = escolherFoco.current?.()
      ?? elemento.querySelector<HTMLElement>('[data-autofocus]')
      ?? elementosFocaveis(elemento).find((el) => !el.hasAttribute('data-fechar'))
      ?? elemento;
    inicial.focus();

    const aoTeclar = (evento: KeyboardEvent) => {
      if (pilha[pilha.length - 1] !== id) return;
      if (evento.key === 'Escape') {
        evento.preventDefault();
        aoEscape.current?.();
        return;
      }
      if (evento.key !== 'Tab') return;
      const focaveis = elementosFocaveis(elemento);
      if (focaveis.length === 0) {
        evento.preventDefault();
        elemento.focus();
        return;
      }
      const primeiro = focaveis[0];
      const ultimo = focaveis[focaveis.length - 1];
      const atual = document.activeElement;
      if (evento.shiftKey && (atual === primeiro || atual === elemento || !elemento.contains(atual))) {
        evento.preventDefault();
        ultimo.focus();
      } else if (!evento.shiftKey && (atual === ultimo || !elemento.contains(atual))) {
        evento.preventDefault();
        primeiro.focus();
      }
    };
    document.addEventListener('keydown', aoTeclar);

    return () => {
      document.removeEventListener('keydown', aoTeclar);
      pilha.splice(pilha.indexOf(id), 1);
      // A camada de baixo volta a ser interativa no mesmo ciclo em que esta sai; o foco só volta depois disso.
      queueMicrotask(() => {
        if (origem?.isConnected) origem.focus();
        else document.querySelector<HTMLElement>(focoReserva)?.focus();
      });
    };
  }, [raiz, ativo, origem, focoReserva]);
};
