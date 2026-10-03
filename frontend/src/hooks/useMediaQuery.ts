import { useSyncExternalStore } from 'react';

// `padrao` vale onde não há matchMedia (testes em jsdom, renderização no servidor).
export const useMediaQuery = (consulta: string, padrao = false): boolean => {
  const assinar = (aviso: () => void) => {
    if (typeof window.matchMedia !== 'function') return () => {};
    const lista = window.matchMedia(consulta);
    lista.addEventListener('change', aviso);
    return () => lista.removeEventListener('change', aviso);
  };
  const ler = () => (typeof window.matchMedia === 'function' ? window.matchMedia(consulta).matches : padrao);
  return useSyncExternalStore(assinar, ler, () => padrao);
};
