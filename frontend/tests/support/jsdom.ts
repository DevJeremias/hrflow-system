// Instala um DOM global antes de o React ser carregado: o react-dom decide no carregamento quais
// eventos o navegador suporta. Importe este módulo antes de qualquer import de react.
import { JSDOM } from 'jsdom';

export const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
Object.defineProperties(globalThis, {
  window: { configurable: true, value: dom.window },
  document: { configurable: true, value: dom.window.document },
  navigator: { configurable: true, value: dom.window.navigator },
  // O FormData do Node não aceita um <form> do jsdom.
  FormData: { configurable: true, value: dom.window.FormData },
  IS_REACT_ACT_ENVIRONMENT: { configurable: true, value: true },
});
// Sem `oninput` no document o React acha que o navegador não tem o evento input e cai no
// caminho do IE (attachEvent), e então nenhum campo digitado chega ao estado.
Object.defineProperty(dom.window.document, 'oninput', { configurable: true, value: null });
