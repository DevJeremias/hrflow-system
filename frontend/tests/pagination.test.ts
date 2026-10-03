import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { employeeService } from '../src/services/employeeService.ts';
import { generateMonthlyPayroll } from '../src/services/payrollService.ts';

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

test('a folha busca todas as páginas quando há mais registros que o limite', async () => {
  const requestedUrls: string[] = [];
  globalThis.fetch = (async (url: string | URL | Request) => {
    const parsed = new URL(String(url), 'http://localhost');
    requestedUrls.push(`${parsed.pathname}${parsed.search}`);
    const page = Number(parsed.searchParams.get('pagina'));
    const start = (page - 1) * 1000;
    const end = Math.min(start + 1000, 1001);
    const rows = Array.from({ length: end - start }, (_, index) => ({ id: start + index + 1 }));
    return new Response(JSON.stringify(rows), {
      status: 200,
      headers: { 'X-Total-Count': '1001', 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;

  const payroll = await generateMonthlyPayroll();

  assert.deepEqual(requestedUrls.sort(), [
    '/api/folha/processar?pagina=1&limite=1000',
    '/api/folha/processar?pagina=2&limite=1000',
  ]);
  assert.equal(payroll.length, 1001);
  assert.equal(payroll[1000].id, 1001);
});

test('a folha de 2.000 colaboradores leva duas chamadas e mantém a ordem das páginas', async () => {
  let chamadas = 0;
  globalThis.fetch = (async (url: string | URL | Request) => {
    chamadas += 1;
    const pagina = Number(new URL(String(url), 'http://localhost').searchParams.get('pagina'));
    // A segunda página responde antes da primeira: a ordem final não pode depender da chegada.
    if (pagina === 1) await new Promise((resolve) => setTimeout(resolve, 20));
    const rows = Array.from({ length: 1000 }, (_, index) => ({ id: (pagina - 1) * 1000 + index + 1 }));
    return new Response(JSON.stringify(rows), { status: 200, headers: { 'X-Total-Count': '2000' } });
  }) as typeof fetch;

  const payroll = await generateMonthlyPayroll();

  assert.equal(chamadas, 2);
  assert.deepEqual(payroll.map((p) => p.id).slice(998, 1002), [999, 1000, 1001, 1002]);
});
