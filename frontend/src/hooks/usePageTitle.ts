import { useEffect } from 'react';

export const NOME_DO_PRODUTO = 'HRFlow';

export const tituloDaPagina = (titulo: string): string => `${titulo} | ${NOME_DO_PRODUTO}`;

// Cada rota anuncia seu nome na aba e ao leitor de tela; sem isso todas ficam com o título do index.html.
export const usePageTitle = (titulo: string): void => {
  useEffect(() => {
    document.title = tituloDaPagina(titulo);
  }, [titulo]);
};
