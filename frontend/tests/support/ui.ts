// Ferramentas dos testes de componente: monta no jsdom, dispara eventos e carrega módulos .tsx pelo Vite.
import assert from 'node:assert/strict';
import { dom } from './jsdom.ts';
import { act, createElement, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createServer, type ViteDevServer } from 'vite';

export { dom, act, createElement };

export const iniciarVite = (): Promise<ViteDevServer> =>
  createServer({ configFile: './vite.config.js', server: { middlewareMode: true, ws: false }, appType: 'custom' });

const montados: { host: HTMLElement; root: Root }[] = [];

export const montar = async (elemento: ReactElement) => {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  montados.push({ host, root });
  await act(async () => { root.render(elemento); });
  return host;
};

export const desmontarTudo = async () => {
  for (const { root, host } of montados.splice(0)) {
    await act(async () => root.unmount());
    host.remove();
  }
  document.title = '';
};

export const esperar = (ms = 0) => act(async () => { await new Promise((resolve) => setTimeout(resolve, ms)); });

export const clicar = async (elemento: Element) => {
  await act(async () => { elemento.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true })); });
};

export const teclar = async (alvo: EventTarget, key: string, opcoes: { shiftKey?: boolean } = {}) => {
  await act(async () => { alvo.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...opcoes })); });
};

export const porRole = (raiz: ParentNode, role: string) => raiz.querySelector<HTMLElement>(`[role="${role}"]`);

export const botaoPorTexto = (raiz: ParentNode, texto: RegExp) => {
  const encontrado = [...raiz.querySelectorAll('button')].find((candidato) => texto.test(candidato.textContent ?? '') || texto.test(candidato.getAttribute('aria-label') ?? ''));
  assert.ok(encontrado, `botão ${texto} não está na tela`);
  return encontrado;
};
