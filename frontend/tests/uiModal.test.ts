import { after, afterEach, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { act, botaoPorTexto, clicar, createElement, desmontarTudo, esperar, iniciarVite, montar, porRole, teclar } from './support/ui.ts';
import { useState, type ComponentType } from 'react';
import type { ViteDevServer } from 'vite';

let server: ViteDevServer;
let Modal: ComponentType<Record<string, unknown>>;
let UiProviders: ComponentType<{ children: unknown }>;
let useConfirm: () => (opcoes: Record<string, unknown>) => Promise<boolean>;

before(async () => {
  server = await iniciarVite();
  ({ default: Modal } = await server.ssrLoadModule('/src/components/ui/Modal.tsx'));
  ({ default: UiProviders } = await server.ssrLoadModule('/src/components/ui/UiProviders.tsx'));
  ({ useConfirm } = await server.ssrLoadModule('/src/components/ui/confirmContext.ts'));
});
after(async () => { await server.close(); });
afterEach(desmontarTudo);

// Página com um botão de origem e um modal de formulário; `fechou` conta os pedidos de fechamento.
const Pagina = ({ aoFechar }: { aoFechar: () => void }) => {
  const [aberto, setAberto] = useState(false);
  return createElement('div', null,
    createElement('button', { type: 'button', id: 'abrir', onClick: () => setAberto(true) }, 'Abrir modal'),
    createElement('a', { href: '#fundo', id: 'fundo' }, 'Link do fundo'),
    aberto && createElement(Modal, { title: 'Novo colaborador', description: 'Preencha os dados.', onClose: () => { aoFechar(); setAberto(false); },
      footer: createElement('button', { type: 'button', id: 'salvar' }, 'Salvar') },
    createElement('input', { id: 'nome', name: 'nome', 'aria-label': 'Nome' }),
    createElement('input', { id: 'email', name: 'email', 'aria-label': 'E-mail' })),
  );
};

const abrir = async () => {
  const fechou = { vezes: 0 };
  const host = await montar(createElement(Pagina, { aoFechar: () => { fechou.vezes += 1; } }));
  const origem = host.querySelector<HTMLButtonElement>('#abrir')!;
  origem.focus();
  await clicar(origem);
  await esperar();
  return { host, origem, fechou };
};

const dialogo = () => porRole(document, 'dialog')!;

test('o modal é role=dialog, aria-modal e se nomeia pelo título', async () => {
  await abrir();
  assert.ok(dialogo());
  assert.equal(dialogo().getAttribute('aria-modal'), 'true');
  const titulo = document.getElementById(dialogo().getAttribute('aria-labelledby')!);
  assert.equal(titulo?.textContent, 'Novo colaborador');
  const descricao = document.getElementById(dialogo().getAttribute('aria-describedby')!);
  assert.equal(descricao?.textContent, 'Preencha os dados.');
});

test('painel lateral mantém semântica de diálogo e sinaliza sua apresentação', async () => {
  await montar(createElement(Modal, { title: 'Novo colaborador', onClose: () => {}, presentation: 'right' },
    createElement('input', { id: 'nome-painel', 'aria-label': 'Nome' }),
  ));
  assert.equal(dialogo().getAttribute('data-panel'), 'right');
  assert.equal(dialogo().getAttribute('aria-modal'), 'true');
  assert.equal(dialogo().getAttribute('aria-labelledby') !== null, true);
});

test('ao abrir, o foco entra no modal (no primeiro campo, não no botão de fechar)', async () => {
  await abrir();
  assert.ok(dialogo().contains(document.activeElement), 'o foco está dentro do diálogo');
  assert.equal(document.activeElement?.id, 'nome');
});

test('Tab não sai do modal: do último elemento volta ao primeiro e Shift+Tab faz o caminho inverso', async () => {
  await abrir();
  document.querySelector<HTMLElement>('#salvar')!.focus();
  await teclar(document.activeElement!, 'Tab');
  assert.ok(dialogo().contains(document.activeElement));
  assert.equal(document.activeElement, botaoPorTexto(dialogo(), /^Fechar$/), 'Tab no último foca o primeiro (o botão Fechar do cabeçalho)');

  await teclar(document.activeElement!, 'Tab', { shiftKey: true });
  assert.equal(document.activeElement?.id, 'salvar', 'Shift+Tab no primeiro foca o último');
});

test('o fundo da página fica inerte enquanto o modal está aberto e volta ao normal ao fechar', async () => {
  const { host } = await abrir();
  assert.ok(host.hasAttribute('inert'));
  await teclar(document, 'Escape');
  await esperar();
  assert.equal(host.hasAttribute('inert'), false);
});

test('Esc fecha o modal e o foco volta ao botão que o abriu', async () => {
  const { origem, fechou } = await abrir();
  await teclar(document.activeElement!, 'Escape');
  await esperar();
  assert.equal(fechou.vezes, 1);
  assert.equal(porRole(document, 'dialog'), null);
  assert.equal(document.activeElement, origem);
});

test('o botão Fechar e o clique no fundo pedem o fechamento; o clique dentro do diálogo não', async () => {
  const { fechou } = await abrir();
  await clicar(dialogo());
  assert.equal(fechou.vezes, 0);
  await clicar(document.querySelector('[data-modal-backdrop]')!);
  assert.equal(fechou.vezes, 1);

  const abertoDeNovo = await abrir();
  await clicar(botaoPorTexto(dialogo(), /^Fechar$/));
  assert.equal(abertoDeNovo.fechou.vezes, 1);
});

test('o modal não deixa contêiner nem rolagem travada depois de fechado', async () => {
  await abrir();
  assert.equal(document.body.style.overflow, 'hidden');
  await teclar(document, 'Escape');
  await esperar();
  assert.equal(document.querySelector('[data-modal-root]'), null);
  assert.notEqual(document.body.style.overflow, 'hidden');
});

test('confirmação sobre um modal: Esc responde "não", devolve o foco ao modal e o devolve ao uso', async () => {
  let resposta: boolean | null = null;
  const registrar = (valor: boolean) => { resposta = valor; };
  const Excluir = () => {
    const confirmar = useConfirm();
    const perguntar = async () => registrar(await confirmar({ title: 'Excluir?', description: 'Não dá para desfazer.', confirmLabel: 'Excluir', tone: 'danger' }));
    return createElement('button', { type: 'button', id: 'excluir', onClick: perguntar }, 'Excluir item');
  };
  const Pai = () => createElement(UiProviders, null, createElement(Modal, { title: 'Modal base', onClose: () => {} }, createElement(Excluir)));
  await montar(createElement(Pai));
  const excluir = document.querySelector<HTMLButtonElement>('#excluir')!;
  excluir.focus();
  await clicar(excluir);
  await esperar();

  const dialogos = document.querySelectorAll('[role="dialog"]');
  assert.equal(dialogos.length, 2);
  assert.equal(document.activeElement?.textContent, 'Cancelar', 'a ação segura recebe o foco');
  assert.ok(document.querySelector('[data-modal-root]')!.hasAttribute('inert'), 'o modal de baixo fica inerte');

  await teclar(document.activeElement!, 'Escape');
  await esperar();
  assert.equal(resposta, false);
  assert.equal(document.querySelectorAll('[role="dialog"]').length, 1);
  assert.equal(document.querySelector('[data-modal-root]')!.hasAttribute('inert'), false);
  assert.equal(document.activeElement, excluir);

  await clicar(excluir);
  await esperar();
  await clicar(botaoPorTexto(document, /^Excluir$/));
  await esperar();
  assert.equal(resposta, true);
  await act(async () => {});
});
