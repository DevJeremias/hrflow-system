import { campo, ausente, opcional, inteiroPositivo } from '../../shared/schemas/comum.ts';
import { paginacao } from '../../shared/schemas/paginacao.ts';

const NOME = /^[a-z_.]{1,60}$/;

// `entidade` é o tipo do registro (funcionario, folha, usuario...) e `acao`, o começo do código da ação
// (login, funcionario.salario_alterado): só letras minúsculas, ponto e sublinhado.
const codigo = (rotulo: string) => campo((valor) => {
    if (ausente(valor)) return { valor: null };
    return typeof valor === 'string' && NOME.test(valor.trim())
        ? { valor: valor.trim() }
        : { erro: `${rotulo} deve ter só letras minúsculas, ponto e sublinhado.` };
});

// `id` só faz sentido com a `entidade` a que pertence.
export const consultaDeAuditoria = paginacao.extend({
    entidade: codigo('Entidade'),
    id: opcional(inteiroPositivo('Identificador')),
    acao: codigo('Ação'),
}).check((ctx) => {
    const { entidade, id } = ctx.value as ConsultaDeAuditoria;
    if (id !== null && entidade === null) {
        ctx.issues.push({ code: 'custom', message: 'Informe a entidade do identificador.', path: ['entidade'], input: entidade });
    }
});

export interface ConsultaDeAuditoria {
    pagina: number;
    limite: number;
    entidade: string | null;
    id: number | null;
    acao: string | null;
}
