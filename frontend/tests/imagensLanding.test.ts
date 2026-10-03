// Imagens da landing: só a primeira do hero carrega com prioridade, as demais esperam a rolagem ou
// a troca de slide, e todas reservam o espaço com width/height (sem salto de layout).
import './support/jsdom.ts';
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement, act, type ComponentType } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { createServer, type ViteDevServer } from 'vite';

let server: ViteDevServer;
const componentes: Record<string, ComponentType> = {};

before(async () => {
  server = await createServer({ configFile: './vite.config.js', server: { middlewareMode: true }, appType: 'custom' });
  componentes.Hero = (await server.ssrLoadModule('/src/pages/Landing/Hero.tsx')).default;
  componentes.AnatomySection = (await server.ssrLoadModule('/src/pages/Landing/AnatomySection.tsx')).default;
});

after(() => server.close());

type Imagem = Record<'src' | 'width' | 'height' | 'loading' | 'decoding' | 'fetchpriority', string | null>;

// Desmonta ao fim: o carrossel do hero mantém um setInterval que seguraria o processo de teste.
const imagensDe = async (nome: string): Promise<Imagem[]> => {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(createElement(MemoryRouter, null, createElement(componentes[nome])));
  });
  const imagens = [...host.querySelectorAll('img')].map((img): Imagem => ({
    src: img.getAttribute('src'), width: img.getAttribute('width'), height: img.getAttribute('height'),
    loading: img.getAttribute('loading'), decoding: img.getAttribute('decoding'), fetchpriority: img.getAttribute('fetchpriority'),
  }));
  await act(async () => root.unmount());
  return imagens;
};

test('as imagens do hero reservam espaço e só a primeira tem prioridade', async () => {
  const imagens = await imagensDe('Hero');
  assert.equal(imagens.length, 5);
  for (const imagem of imagens) {
    assert.ok(imagem.width && imagem.height, `${imagem.src} sem width/height`);
    assert.equal(imagem.decoding, 'async');
  }
  const [primeira, ...demais] = imagens;
  assert.equal(primeira.fetchpriority, 'high');
  assert.notEqual(primeira.loading, 'lazy', 'a primeira imagem não pode ser lazy');
  for (const imagem of demais) assert.equal(imagem.loading, 'lazy', imagem.src ?? '');
});

test('a imagem da seção Anatomia é lazy e reserva espaço', async () => {
  const [imagem] = await imagensDe('AnatomySection');
  assert.equal(imagem.loading, 'lazy');
  assert.equal(imagem.decoding, 'async');
  assert.ok(imagem.width && imagem.height);
});
