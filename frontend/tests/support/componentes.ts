// Base dos testes de componente: o DOM do jsdom, o Vite que compila o TSX do app e um fetch de mentira.
// Este módulo precisa ser o primeiro import do teste: o react-dom e o Testing Library decidem no
// carregamento o que o navegador suporta e onde está o document.
import { dom } from './jsdom.ts';
import { cleanup } from '@testing-library/react';
import { createServer, type ViteDevServer } from 'vite';

export { dom };

// Vite em modo middleware, só para o ssrLoadModule compilar os .tsx do app (JSX, imports sem extensão).
export const abrirVite = (): Promise<ViteDevServer> =>
  createServer({ configFile: './vite.config.js', server: { middlewareMode: true, ws: false }, appType: 'custom' });

// Desmonta o que o teste renderizou: o node:test não tem o afterEach global em que o Testing Library
// se registra sozinho. Chame no afterEach de cada arquivo.
export const limparTela = () => {
  cleanup();
  dom.window.document.cookie = 'hrflow_csrf=; Max-Age=0; Path=/';
};

export interface Chamada {
  metodo: string;
  caminho: string;
  corpo?: unknown;
}

type Resposta = { status?: number; corpo?: unknown; cabecalhos?: Record<string, string> };

export const resposta = ({ status = 200, corpo, cabecalhos = {} }: Resposta = {}) =>
  new Response(corpo === undefined ? null : JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json', ...cabecalhos } });

// Troca o fetch global por `rotear`, que recebe cada chamada (caminho sem o prefixo /api) e devolve a
// resposta; `rotear` pode lançar TypeError para simular rede fora. Devolve as chamadas feitas e a
// função que restaura o fetch original.
// O corpo enviado: JSON vira objeto; texto puro (o CSV da importação) chega como está.
const corpoDe = (corpo: BodyInit | null | undefined): unknown => {
  if (!corpo) return undefined;
  try {
    return JSON.parse(String(corpo));
  } catch {
    return String(corpo);
  }
};

export const simularApi = (rotear: (chamada: Chamada) => Resposta | Promise<Resposta> | Response | Promise<Response>) => {
  const original = globalThis.fetch;
  const chamadas: Chamada[] = [];
  globalThis.fetch = (async (entrada: RequestInfo | URL, init?: RequestInit) => {
    const chamada: Chamada = {
      metodo: (init?.method ?? 'GET').toUpperCase(),
      caminho: String(entrada).replace(/^\/api/, ''),
      corpo: corpoDe(init?.body),
    };
    chamadas.push(chamada);
    const saida = await rotear(chamada);
    return saida instanceof Response ? saida : resposta(saida);
  }) as typeof fetch;
  return { chamadas, restaurar: () => { globalThis.fetch = original; } };
};
