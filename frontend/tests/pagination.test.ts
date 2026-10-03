import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { employeeService } from '../src/services/employeeService.ts';
import { getPayroll, processPayroll, closePayroll } from '../src/services/payrollService.ts';

const fetchOriginal = globalThis.fetch;
const memoria = new Map<string, string>();

Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key: string) => memoria.get(key) ?? null,
    setItem: (key: string, value: string) => { memoria.set(key, value); },
    removeItem: (key: string) => { memoria.delete(key); },
  },
});

afterEach(() => {
  globalThis.fetch = fetchOriginal;
});

test('a tabela de colaboradores solicita a página pedida e usa X-Total-Count', async () => {
  let requestedUrl = '';
  globalThis.fetch = (async (url: string | URL | Request) => {
    requestedUrl = String(url);
    return new Response(JSON.stringify([{ id: 51, nome: 'Colaborador fictício' }]), {
      status: 200,
      headers: { 'X-Total-Count': '501', 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;

  const result = await employeeService.getPage({ pagina: 2, limite: 50 });

  assert.match(requestedUrl, /\/api\/funcionarios\?pagina=2&limite=50$/);
  assert.equal(result.total, 501);
  assert.equal(result.employees[0].id, '51');
});

test('a busca de colaboradores vai ao servidor com o texto e os filtros, sem parâmetros vazios', async () => {
  let requestedUrl = '';
  globalThis.fetch = (async (url: string | URL | Request) => {
    requestedUrl = String(url);
    return new Response('[]', { status: 200, headers: { 'X-Total-Count': '0' } });
  }) as typeof fetch;

  await employeeService.getPage({ pagina: 1, limite: 50, busca: 'Gamma Pessoa 52', status: 'Ativo', departamentoId: '7' });
  assert.equal(requestedUrl, '/api/funcionarios?pagina=1&limite=50&busca=Gamma+Pessoa+52&status=Ativo&departamento_id=7');

  await employeeService.getPage({ pagina: 1, limite: 50, busca: '', status: '', departamentoId: '' });
  assert.equal(requestedUrl, '/api/funcionarios?pagina=1&limite=50');
});

test('a folha pede a competência na URL e entende "ainda não processada" como ausência', async () => {
  const chamadas: string[] = [];
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    chamadas.push(`${init?.method ?? 'GET'} ${url}`);
    if (String(url).endsWith('/2026-09')) {
      return new Response(JSON.stringify({ erro: 'A folha de 09/2026 ainda não foi processada.' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({ competencia: '2026-10', status: 'aberta', itens: [], pendencias: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;

  assert.equal(await getPayroll('2026-09'), null);
  assert.equal((await getPayroll('2026-10'))?.status, 'aberta');
  await processPayroll('2026-10');
  await closePayroll('2026-10');

  assert.deepEqual(chamadas, [
    'GET /api/folha/competencias/2026-09',
    'GET /api/folha/competencias/2026-10',
    'POST /api/folha/competencias/2026-10/processar',
    'POST /api/folha/competencias/2026-10/fechar',
  ]);
});

test('as ações da folha mostram a mensagem que a API devolveu', async () => {
  globalThis.fetch = (async () => new Response(JSON.stringify({ erro: 'A folha de 10/2026 está fechada e não pode ser processada de novo.' }), { status: 409, headers: { 'Content-Type': 'application/json' } })) as typeof fetch;
  await assert.rejects(() => processPayroll('2026-10'), /está fechada/);
  await assert.rejects(() => closePayroll('2026-10'), /está fechada/);
});

test('uma falha que não é "não processada" não vira folha ausente', async () => {
  globalThis.fetch = (async () => new Response(JSON.stringify({ erro: 'Erro ao buscar a folha de pagamento' }), { status: 500, headers: { 'Content-Type': 'application/json' } })) as typeof fetch;
  await assert.rejects(() => getPayroll('2026-10'), /Erro ao buscar a folha/);
});
