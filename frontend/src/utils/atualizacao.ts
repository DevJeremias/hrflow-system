// Depois de um deploy, os arquivos de uma tela que o navegador ainda não carregou deixam de
// existir com o nome antigo: o `import()` da rota falha (vite:preloadError). Recarregar traz o
// app novo. Uma segunda falha logo em seguida não é deploy, é rede ou servidor: não recarrega de
// novo, para não entrar em laço.
const CHAVE = 'hrflow:recarga-por-atualizacao';
const JANELA_MS = 10_000;

interface Ambiente {
  armazenamento: Pick<Storage, 'getItem' | 'setItem'>;
  recarregar: () => void;
  agora: () => number;
}

export const recarregarAposAtualizacao = ({ armazenamento, recarregar, agora }: Ambiente): boolean => {
  try {
    const ultima = Number(armazenamento.getItem(CHAVE));
    if (ultima && agora() - ultima < JANELA_MS) return false;
    armazenamento.setItem(CHAVE, String(agora()));
  } catch {
    // Sem sessionStorage não há como evitar o laço: não recarrega.
    return false;
  }
  recarregar();
  return true;
};

export const tratarFalhaDeCarregamento = (): void => {
  window.addEventListener('vite:preloadError', (evento) => {
    const recarregou = recarregarAposAtualizacao({
      armazenamento: window.sessionStorage,
      recarregar: () => window.location.reload(),
      agora: Date.now,
    });
    if (recarregou) evento.preventDefault();
  });
};
