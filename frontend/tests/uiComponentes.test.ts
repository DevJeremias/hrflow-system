import { after, afterEach, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { act, botaoPorTexto, clicar, createElement, desmontarTudo, iniciarVite, montar, porRole, teclar } from './support/ui.ts';
import { useState } from 'react';
import type { ViteDevServer } from 'vite';

let server: ViteDevServer;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let ui: Record<string, any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let hooks: Record<string, any>;

before(async () => {
  server = await iniciarVite();
  const carregar = async (nome: string) => (await server.ssrLoadModule(`/src/components/ui/${nome}`));
  ui = {
    Button: (await carregar('Button.tsx')).default,
    IconButton: (await carregar('Button.tsx')).IconButton,
    ...(await carregar('Field.tsx')),
    Field: (await carregar('Field.tsx')).default,
    Tabs: (await carregar('Tabs.tsx')).default,
    TabPanel: (await carregar('Tabs.tsx')).TabPanel,
    DataTable: (await carregar('DataTable.tsx')).default,
    UiProviders: (await carregar('UiProviders.tsx')).default,
    useToast: (await carregar('toastContext.ts')).useToast,
    Badge: (await carregar('Badge.tsx')).default,
    Avatar: (await carregar('Avatar.tsx')).default,
  };
  hooks = await server.ssrLoadModule('/src/hooks/usePageTitle.ts');
});
after(async () => { await server.close(); });
afterEach(desmontarTudo);

test('Button começa com type="button" e loading desabilita e marca aria-busy sem mudar o texto', async () => {
  const host = await montar(createElement('form', null, createElement(ui.Button, null, 'Cancelar'), createElement(ui.Button, { type: 'submit', loading: true }, 'Salvando...')));
  const [cancelar, salvar] = host.querySelectorAll('button');
  assert.equal(cancelar.type, 'button');
  assert.equal(salvar.type, 'submit');
  assert.equal(salvar.disabled, true);
  assert.equal(salvar.getAttribute('aria-busy'), 'true');
  assert.equal(salvar.textContent, 'Salvando...');
});

test('IconButton exige nome: aria-label e title com o mesmo texto', async () => {
  const host = await montar(createElement(ui.IconButton, { label: 'Excluir cargo X' }, createElement('svg')));
  const botao = host.querySelector('button')!;
  assert.equal(botao.getAttribute('aria-label'), 'Excluir cargo X');
  assert.equal(botao.title, 'Excluir cargo X');
});

test('Field liga o label ao controle por for/id e injeta name, required e as descrições aria', async () => {
  const host = await montar(createElement('div', null,
    createElement(ui.Field, { label: 'E-mail', name: 'email', required: true, hint: 'Use o e-mail pessoal.', error: 'E-mail inválido.' }, createElement(ui.Input, { type: 'email' })),
    createElement(ui.Field, { label: 'Cargo', name: 'cargo' }, createElement(ui.Select, null, createElement('option', { value: '' }, 'Escolha'))),
    createElement(ui.Field, { label: 'Observação', name: 'obs', hideLabel: true }, createElement(ui.Textarea)),
  ));
  for (const controle of host.querySelectorAll<HTMLInputElement>('input, select, textarea')) {
    assert.ok(controle.id, 'todo campo tem id');
    assert.ok(controle.name, 'todo campo tem name');
    const rotulo = host.querySelector(`label[for="${controle.id}"]`);
    assert.ok(rotulo, `há um <label for> para ${controle.name}`);
  }
  const email = host.querySelector<HTMLInputElement>('[name="email"]')!;
  assert.equal(email.required, true);
  assert.equal(email.getAttribute('aria-invalid'), 'true');
  const descricao = email.getAttribute('aria-describedby')!.split(' ').map((id) => document.getElementById(id)?.textContent);
  assert.deepEqual(descricao, ['Use o e-mail pessoal.', 'E-mail inválido.']);
  assert.ok(host.querySelector('label[for^="obs-"]')!.classList.contains('sr-only'), 'hideLabel só esconde visualmente');
});

test('dois campos com o mesmo name na página não colidem nos ids', async () => {
  const host = await montar(createElement('div', null,
    createElement(ui.Field, { label: 'Nome', name: 'nome' }, createElement(ui.Input)),
    createElement(ui.Field, { label: 'Nome', name: 'nome' }, createElement(ui.Input)),
  ));
  const [a, b] = host.querySelectorAll('input');
  assert.notEqual(a.id, b.id);
});

const AbasDeTeste = () => {
  const [ativa, setAtiva] = useState<'a' | 'b' | 'c'>('a');
  return createElement('div', null,
    createElement(ui.Tabs, { tabs: [{ id: 'a', label: 'Pessoal' }, { id: 'b', label: 'Contrato' }, { id: 'c', label: 'Financeiro' }], value: ativa, onChange: setAtiva, label: 'Seções', idPrefix: 'teste' }),
    createElement(ui.TabPanel, { idPrefix: 'teste', id: ativa }, `Painel ${ativa}`));
};

test('Tabs segue o padrão WAI-ARIA: tablist, aria-selected, roving tabindex, setas, Home e End', async () => {
  const host = await montar(createElement(AbasDeTeste));
  assert.ok(porRole(host, 'tablist'));
  const abas = () => [...host.querySelectorAll<HTMLElement>('[role="tab"]')];
  assert.deepEqual(abas().map((aba) => aba.getAttribute('aria-selected')), ['true', 'false', 'false']);
  assert.deepEqual(abas().map((aba) => aba.tabIndex), [0, -1, -1], 'só a aba ativa entra na ordem de Tab');
  const painel = porRole(host, 'tabpanel')!;
  assert.equal(painel.getAttribute('aria-labelledby'), abas()[0].id);
  assert.equal(abas()[0].getAttribute('aria-controls'), painel.id);

  abas()[0].focus();
  await teclar(abas()[0], 'ArrowRight');
  assert.equal(abas()[1].getAttribute('aria-selected'), 'true');
  assert.equal(document.activeElement, abas()[1]);
  await teclar(abas()[1], 'End');
  assert.equal(abas()[2].getAttribute('aria-selected'), 'true');
  await teclar(abas()[2], 'ArrowRight');
  assert.equal(abas()[0].getAttribute('aria-selected'), 'true', 'a seta volta ao início');
  await teclar(abas()[0], 'ArrowLeft');
  assert.equal(abas()[2].getAttribute('aria-selected'), 'true');
  assert.equal(host.querySelector('[role="tabpanel"]')!.textContent, 'Painel c');
});

type Cargo = { id: number; titulo: string; salario: string };
const CARGOS: Cargo[] = [{ id: 1, titulo: 'Analista', salario: 'R$ 5.000,00' }, { id: 2, titulo: 'Gerente', salario: 'R$ 9.000,00' }];

test('DataTable: tabela semântica com legenda, th scope=col e cada célula rotulada para o modo cartão', async () => {
  const colunas = [
    { key: 'titulo', header: 'Cargo', cell: (c: Cargo) => c.titulo },
    { key: 'salario', header: 'Salário base', cell: (c: Cargo) => c.salario, align: 'right' },
    { key: 'acoes', header: 'Ações', semRotuloNoCartao: true, cell: (c: Cargo) => createElement('button', { type: 'button' }, `Editar ${c.titulo}`) },
  ];
  const host = await montar(createElement(ui.DataTable, { caption: 'Cargos da empresa', columns: colunas, rows: CARGOS, rowKey: (c: Cargo) => c.id }));
  assert.equal(host.querySelector('caption')?.textContent, 'Cargos da empresa');
  assert.deepEqual([...host.querySelectorAll('th')].map((th) => [th.textContent, th.getAttribute('scope')]), [['Cargo', 'col'], ['Salário base', 'col'], ['Ações', 'col']]);
  const primeira = host.querySelector('tbody tr')!;
  assert.deepEqual([...primeira.querySelectorAll('td')].map((td) => td.getAttribute('data-label')), ['Cargo', 'Salário base', null]);
  // O modo cartão é CSS: abaixo de md a tabela é `block` e a linha é um cartão; a coluna Ações continua no DOM, ao alcance.
  const tabela = host.querySelector('table')!;
  assert.match(tabela.className, /\bblock\b/);
  assert.match(tabela.className, /\bmd:table\b/);
  assert.match(primeira.className, /\bblock\b/);
  assert.ok(primeira.querySelector('button'), 'os botões de ação estão na linha');
  assert.match(host.querySelector('thead')!.className, /sr-only/, 'no cartão o cabeçalho segue para leitores de tela');
});

test('DataTable: rodapé de totais, esqueleto de carregamento e estado vazio', async () => {
  const colunas = [
    { key: 'titulo', header: 'Cargo', cell: (c: Cargo) => c.titulo, footer: 'Total' },
    { key: 'salario', header: 'Salário', cell: (c: Cargo) => c.salario, footer: 'R$ 14.000,00' },
  ];
  let host = await montar(createElement(ui.DataTable, { caption: 'x', columns: colunas, rows: CARGOS, rowKey: (c: Cargo) => c.id }));
  assert.equal(host.querySelector('tfoot')!.textContent, 'TotalR$ 14.000,00');

  host = await montar(createElement(ui.DataTable, { caption: 'x', columns: colunas, rows: [], rowKey: (c: Cargo) => c.id, loading: true }));
  assert.equal(host.querySelector('table')!.getAttribute('aria-busy'), 'true');
  assert.equal(host.querySelectorAll('tbody tr').length, 4);

  host = await montar(createElement(ui.DataTable, { caption: 'x', columns: colunas, rows: [], rowKey: (c: Cargo) => c.id, empty: createElement('p', null, 'Nenhum cargo.') }));
  assert.equal(host.textContent, 'Nenhum cargo.');
  assert.equal(host.querySelector('table'), null);
});

const Disparador = () => {
  const toast = ui.useToast();
  return createElement('div', null,
    createElement('button', { type: 'button', onClick: () => toast.success('Colaborador salvo.') }, 'ok'),
    createElement('button', { type: 'button', onClick: () => toast.error('Não foi possível excluir.') }, 'erro'));
};

test('Toast: sucesso entra na região de status, erro na região de alerta, e o botão dispensa', async () => {
  await montar(createElement(ui.UiProviders, null, createElement(Disparador)));
  const status = document.querySelector('[role="status"]')!;
  const alerta = document.querySelector('[role="alert"]')!;
  assert.ok(status && alerta, 'as regiões existem antes de qualquer toast');

  await clicar(botaoPorTexto(document, /^ok$/));
  assert.equal(status.textContent, 'Colaborador salvo.');
  await clicar(botaoPorTexto(document, /^erro$/));
  assert.equal(alerta.textContent, 'Não foi possível excluir.');

  await clicar(botaoPorTexto(alerta as HTMLElement, /Fechar notificação/));
  assert.equal(alerta.textContent, '');
  assert.equal(status.textContent, 'Colaborador salvo.');
});

test('Toast: some sozinho depois do prazo', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  await montar(createElement(ui.UiProviders, null, createElement(Disparador)));
  await clicar(botaoPorTexto(document, /^ok$/));
  assert.equal(document.querySelector('[role="status"]')!.textContent, 'Colaborador salvo.');
  await act(async () => { t.mock.timers.tick(5000); });
  assert.equal(document.querySelector('[role="status"]')!.textContent, '');
});

test('useToast fora do provedor falha com mensagem clara', async () => {
  const Sem = () => { ui.useToast(); return null; };
  const antes = console.error;
  console.error = () => {};
  try {
    await assert.rejects(montar(createElement(Sem)), /ToastProvider/);
  } finally {
    console.error = antes;
  }
});

test('usePageTitle muda o <title> a cada página e o formato é "Página | HRFlow"', async () => {
  const Pagina = ({ nome }: { nome: string }) => { hooks.usePageTitle(nome); return null; };
  await montar(createElement(Pagina, { nome: 'Folha de Pagamento' }));
  assert.equal(document.title, 'Folha de Pagamento | HRFlow');
  await desmontarTudo();
  await montar(createElement(Pagina, { nome: 'Colaboradores' }));
  assert.equal(document.title, 'Colaboradores | HRFlow');
});

test('Avatar sem foto mostra a inicial escondida do leitor de tela; com foto a imagem é decorativa por padrão', async () => {
  let host = await montar(createElement(ui.Avatar, { name: 'ana Ficticia' }));
  assert.equal(host.textContent, 'a');
  assert.equal(host.querySelector('[aria-hidden="true"]')?.textContent, 'a');
  host = await montar(createElement(ui.Avatar, { name: 'Ana', src: 'data:image/png;base64,AA==' }));
  assert.equal(host.querySelector('img')!.getAttribute('alt'), '');
});
