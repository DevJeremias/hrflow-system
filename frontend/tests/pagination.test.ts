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

  const result = await employeeService.getPage(2, 50);

  assert.match(requestedUrl, /\/api\/funcionarios\?pagina=2&limite=50$/);
  assert.equal(result.total, 501);
  assert.equal(result.employees[0].id, '51');
});

test('a folha busca todas as páginas quando há mais registros que o limite', async () => {
  const requestedUrls: string[] = [];
  globalThis.fetch = (async (url: string | URL | Request) => {
    const parsed = new URL(String(url), 'http://localhost');
    requestedUrls.push(`${parsed.pathname}${parsed.search}`);
    const page = Number(parsed.searchParams.get('pagina'));
    const start = (page - 1) * 500;
    const end = Math.min(start + 500, 1001);
    const rows = Array.from({ length: end - start }, (_, index) => ({ id: start + index + 1 }));
    return new Response(JSON.stringify(rows), {
      status: 200,
      headers: { 'X-Total-Count': '1001', 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;

  const payroll = await generateMonthlyPayroll();

  assert.deepEqual(requestedUrls, [
    '/api/folha/processar?pagina=1&limite=500',
    '/api/folha/processar?pagina=2&limite=500',
    '/api/folha/processar?pagina=3&limite=500',
  ]);
  assert.equal(payroll.length, 1001);
  assert.equal(payroll[1000].id, 1001);
});
