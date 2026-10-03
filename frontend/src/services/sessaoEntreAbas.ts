import type { User } from '../utils/sessao';

// O cookie da sessão é um só para todas as abas do navegador, mas cada aba guarda a sua própria
// cópia da identidade. Quem entra ou sai numa aba precisa avisar as outras, e a aba que volta ao
// primeiro plano confere quem é o dono do cookie antes de aceitar qualquer ação: sem isso, duas
// pessoas revezando o mesmo navegador veriam a tela de uma e gravariam como a outra.
export const NOME_DO_CANAL = 'hrflow-sessao';

type Mensagem = { tipo: 'login' | 'logout'; origem: string };

const ehMensagem = (dados: unknown): dados is Mensagem =>
  typeof dados === 'object' && dados !== null
  && ((dados as Mensagem).tipo === 'login' || (dados as Mensagem).tipo === 'logout')
  && typeof (dados as Mensagem).origem === 'string';

// Cada canal recebe o que os outros objetos do mesmo nome enviam, inclusive os da própria aba:
// a origem permite a esta aba ignorar o que ela mesma avisou.
const ORIGEM = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

export const avisarAbas = (tipo: Mensagem['tipo']): void => {
  if (typeof BroadcastChannel === 'undefined') return;
  const canal = new BroadcastChannel(NOME_DO_CANAL);
  canal.postMessage({ tipo, origem: ORIGEM } satisfies Mensagem);
  canal.close();
};

interface Observador {
  // Id do usuário que esta aba exibe; null sem sessão (nada a proteger).
  idAtual: () => number | null;
  // Confirma no servidor quem é o dono do cookie. Rejeita com `status` quando a API recusa.
  buscarSessao: () => Promise<User>;
  // O cookie pertence a outra pessoa: a aba passa a ser dela.
  aoTrocar: (novo: User) => void;
  // A sessão acabou em outra aba (saída, troca de senha).
  aoEncerrar: () => void;
  janela?: EventTarget;
  documento?: EventTarget & { visibilityState?: string };
}

// Devolve a função que desfaz a observação. Falha de rede na conferência é ignorada: a aba
// segue como está e o próximo foco confere de novo; só um 401 ou outra identidade mudam o estado.
export const observarSessao = ({
  idAtual, buscarSessao, aoTrocar, aoEncerrar,
  janela = globalThis.window, documento = globalThis.document,
}: Observador): (() => void) => {
  let conferindo = false;

  const conferir = async (aviso: Mensagem['tipo'] | 'foco') => {
    if (conferindo || idAtual() === null) return;
    conferindo = true;
    try {
      const sessao = await buscarSessao();
      const id = idAtual();
      if (id !== null && sessao.id !== id) aoTrocar(sessao);
    } catch (erro) {
      // O cliente HTTP já encerrou a sessão com o aviso de expiração; se foi o outro lado que a
      // encerrou, a mensagem certa é a de saída.
      if (aviso === 'logout' && (erro as { status?: number })?.status === 401) aoEncerrar();
    } finally {
      conferindo = false;
    }
  };

  const canal = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(NOME_DO_CANAL);
  if (canal) {
    canal.onmessage = (evento: MessageEvent) => {
      if (ehMensagem(evento.data) && evento.data.origem !== ORIGEM) void conferir(evento.data.tipo);
    };
  }

  const aoVoltar = () => void conferir('foco');
  const aoMudarVisibilidade = () => {
    if (documento?.visibilityState === 'visible') aoVoltar();
  };
  janela?.addEventListener('focus', aoVoltar);
  documento?.addEventListener('visibilitychange', aoMudarVisibilidade);

  return () => {
    canal?.close();
    janela?.removeEventListener('focus', aoVoltar);
    documento?.removeEventListener('visibilitychange', aoMudarVisibilidade);
  };
};
