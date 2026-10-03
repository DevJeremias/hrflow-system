// Duas abas nunca misturam pessoas (B-08): o aviso de login e de saída pelo BroadcastChannel e a
// conferência de identidade ao voltar o foco. Roda no Node, com o BroadcastChannel real dele e
// janela e documento de mentira.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { avisarAbas, observarSessao } from '../src/services/sessaoEntreAbas.ts';
import { textoDeEspera, mensagemDeLimite } from '../src/utils/espera.ts';
import type { User } from '../src/utils/sessao.ts';

const usuario = (id: number): User => ({ id, nome: `Pessoa Ficticia ${id}`, role: 'Colaborador', funcionarioId: id, avatar: null });

const aguardar = async (condicao: () => boolean) => {
  for (let i = 0; i < 100 && !condicao(); i += 1) await new Promise((resolve) => setTimeout(resolve, 10));
  assert.ok(condicao(), 'a condição não se cumpriu a tempo');
};
const esperarUmPouco = () => new Promise((resolve) => setTimeout(resolve, 80));

class Documento extends EventTarget {
  visibilityState = 'visible';
}

const desfazer: Array<() => void> = [];
afterEach(() => desfazer.splice(0).forEach((fn) => fn()));

// Uma aba: o que ela exibe (`atual`), o que o servidor diz ser o dono do cookie (`donoDoCookie`)
// e o que o observador fez.
const abrirAba = (inicial: User | null, donoDoCookie: () => Promise<User>) => {
  const aba = {
    atual: inicial,
    conferencias: 0,
    encerrada: 0,
    janela: new EventTarget(),
    documento: new Documento(),
  };
  desfazer.push(observarSessao({
    idAtual: () => aba.atual?.id ?? null,
    buscarSessao: () => { aba.conferencias += 1; return donoDoCookie(); },
    aoTrocar: (novo) => { aba.atual = novo; },
    aoEncerrar: () => { aba.atual = null; aba.encerrada += 1; },
    janela: aba.janela,
    documento: aba.documento,
  }));
  return aba;
};

// Aviso como outra aba o enviaria: de uma origem diferente da deste processo.
const deOutraAba = (tipo: 'login' | 'logout') => {
  const canal = new BroadcastChannel('hrflow-sessao');
  canal.postMessage({ tipo, origem: 'outra-aba' });
  canal.close();
};

const erroHttp = (status: number) => Object.assign(new Error('recusado'), { status });

test('login de outra pessoa em outra aba troca o usuário desta aba antes de qualquer escrita', async () => {
  const aba = abrirAba(usuario(1), async () => usuario(2));
  deOutraAba('login');
  await aguardar(() => aba.atual?.id === 2);
});

test('login da mesma pessoa em outra aba não muda nada', async () => {
  const aba = abrirAba(usuario(1), async () => usuario(1));
  deOutraAba('login');
  await aguardar(() => aba.conferencias === 1);
  await esperarUmPouco();
  assert.equal(aba.atual?.id, 1);
});

test('a aba que não tem sessão não consulta o servidor', async () => {
  const aba = abrirAba(null, async () => usuario(2));
  deOutraAba('login');
  aba.janela.dispatchEvent(new Event('focus'));
  await esperarUmPouco();
  assert.equal(aba.conferencias, 0);
  assert.equal(aba.atual, null);
});

test('ao voltar o foco, a aba confere o dono do cookie e troca se divergir', async () => {
  let dono = usuario(1);
  const aba = abrirAba(usuario(1), async () => dono);

  aba.janela.dispatchEvent(new Event('focus'));
  await aguardar(() => aba.conferencias === 1);
  assert.equal(aba.atual?.id, 1);

  dono = usuario(7);
  aba.janela.dispatchEvent(new Event('focus'));
  await aguardar(() => aba.atual?.id === 7);
});

test('visibilitychange só confere quando a aba fica visível', async () => {
  const aba = abrirAba(usuario(1), async () => usuario(3));
  aba.documento.visibilityState = 'hidden';
  aba.documento.dispatchEvent(new Event('visibilitychange'));
  await esperarUmPouco();
  assert.equal(aba.conferencias, 0);

  aba.documento.visibilityState = 'visible';
  aba.documento.dispatchEvent(new Event('visibilitychange'));
  await aguardar(() => aba.atual?.id === 3);
});

test('foco e visibilidade juntos viram uma só conferência', async () => {
  const aba = abrirAba(usuario(1), () => new Promise((resolve) => setTimeout(() => resolve(usuario(1)), 30)));
  aba.janela.dispatchEvent(new Event('focus'));
  aba.documento.dispatchEvent(new Event('visibilitychange'));
  await esperarUmPouco();
  assert.equal(aba.conferencias, 1);
});

test('saída em outra aba encerra esta aba quando o servidor recusa a sessão', async () => {
  const aba = abrirAba(usuario(1), async () => { throw erroHttp(401); });
  deOutraAba('logout');
  await aguardar(() => aba.encerrada === 1);
  assert.equal(aba.atual, null);
});

test('saída seguida de login de outra pessoa mostra a pessoa nova, não uma sessão encerrada', async () => {
  const aba = abrirAba(usuario(1), async () => usuario(2));
  deOutraAba('logout');
  await aguardar(() => aba.atual?.id === 2);
  assert.equal(aba.encerrada, 0);
});

test('falha de rede na conferência não derruba nem troca a sessão', async () => {
  const aba = abrirAba(usuario(1), async () => { throw erroHttp(0); });
  deOutraAba('logout');
  aba.janela.dispatchEvent(new Event('focus'));
  await aguardar(() => aba.conferencias >= 1);
  await esperarUmPouco();
  assert.equal(aba.atual?.id, 1);
  assert.equal(aba.encerrada, 0);
});

test('o aviso que a própria aba enviou não a faz conferir de novo', async () => {
  const aba = abrirAba(usuario(1), async () => { throw erroHttp(401); });
  avisarAbas('logout');
  avisarAbas('login');
  await esperarUmPouco();
  assert.equal(aba.conferencias, 0);
});

test('mensagens estranhas no canal são ignoradas', async () => {
  const aba = abrirAba(usuario(1), async () => usuario(2));
  const estranho = new BroadcastChannel('hrflow-sessao');
  desfazer.push(() => estranho.close());
  for (const lixo of [{ tipo: 'apagar-tudo', origem: 'x' }, { tipo: 'login' }, 'login', null]) estranho.postMessage(lixo);
  await esperarUmPouco();
  assert.equal(aba.conferencias, 0);
});

test('depois de desfeita, a observação não reage mais', async () => {
  const aba = abrirAba(usuario(1), async () => usuario(2));
  desfazer.splice(0).forEach((fn) => fn());
  aba.janela.dispatchEvent(new Event('focus'));
  deOutraAba('login');
  await esperarUmPouco();
  assert.equal(aba.conferencias, 0);
});

test('textoDeEspera descreve o tempo em segundos ou minutos', () => {
  assert.equal(textoDeEspera(1), '1 segundo');
  assert.equal(textoDeEspera(45), '45 segundos');
  assert.equal(textoDeEspera(60), '1 minuto');
  assert.equal(textoDeEspera(61), '2 minutos');
  assert.equal(textoDeEspera(900), '15 minutos');
  for (const invalido of [0, -3, NaN, Infinity, '900', null, undefined]) assert.equal(textoDeEspera(invalido), null);
});

test('mensagemDeLimite usa o tempo do servidor e, sem ele, a mensagem original', () => {
  assert.equal(mensagemDeLimite({ retryAfterSegundos: 900 }, 'x'), 'Muitas tentativas. Tente novamente em 15 minutos.');
  assert.equal(mensagemDeLimite({}, 'Mensagem do servidor.'), 'Mensagem do servidor.');
  assert.equal(mensagemDeLimite(undefined, 'Mensagem do servidor.'), 'Mensagem do servidor.');
});
