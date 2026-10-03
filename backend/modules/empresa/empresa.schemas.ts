import { campo, corpoEstrito, texto, enumerado, opcional, ausente } from '../../shared/schemas/comum.ts';
import { validarEmail, validarTexto } from '../../shared/schemas/validadores.ts';
import { normalizarCnpj } from './empresa.regras.ts';

export const REGIMES_TRIBUTARIOS = ['Simples Nacional', 'Lucro Presumido', 'Lucro Real'] as const;

const cnpj = campo((valor: unknown) => {
    if (typeof valor !== 'string' || valor.trim() === '') return { erro: 'CNPJ é obrigatório.' };
    const digitos = normalizarCnpj(valor);
    return digitos ? { valor: digitos } : { erro: 'CNPJ inválido: confira os 14 dígitos.' };
});

// O encarregado pelo tratamento de dados pessoais (LGPD, art. 41). Chave ausente mantém o que está
// gravado (undefined); '' ou null o apagam (null). Nome e e-mail vêm juntos ou não vêm.
const encarregadoNome = campo((valor: unknown) => {
    if (valor === undefined) return { valor: undefined };
    if (ausente(valor)) return { valor: null };
    const erro = validarTexto(valor, 'Nome do encarregado', 255);
    return erro ? { erro } : { valor: (valor as string).trim() };
});

const encarregadoEmail = campo((valor: unknown) => {
    if (valor === undefined) return { valor: undefined };
    if (ausente(valor)) return { valor: null };
    const erro = validarEmail(valor);
    return erro ? { erro } : { valor: (valor as string).trim().toLowerCase() };
});

export const dadosDaEmpresa = corpoEstrito({
    razao_social: texto('Razão social', 255),
    cnpj,
    regime_tributario: opcional(enumerado('Regime tributário', REGIMES_TRIBUTARIOS)),
    encarregado_nome: encarregadoNome,
    encarregado_email: encarregadoEmail,
}).check((ctx) => {
    const { encarregado_nome: nome, encarregado_email: email } = ctx.value as DadosDaEmpresa;
    if ((nome === undefined) !== (email === undefined) || (nome === null) !== (email === null)) {
        ctx.issues.push({ code: 'custom', message: 'Informe o nome e o e-mail do encarregado, ou deixe os dois em branco.', path: ['encarregado_nome'], input: nome });
    }
});

// O que o schema entrega em req.dadosValidados. O tipo é escrito à mão: mude-o junto com o schema.
export interface DadosDaEmpresa {
    razao_social: string;
    cnpj: string;
    regime_tributario: typeof REGIMES_TRIBUTARIOS[number] | null;
    // undefined: manter o que está gravado; null: apagar.
    encarregado_nome?: string | null;
    encarregado_email?: string | null;
}

