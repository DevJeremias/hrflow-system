import { campo, corpoEstrito, texto, enumerado, opcional } from '../../shared/schemas/comum.ts';
import { normalizarCnpj } from './empresa.regras.ts';

export const REGIMES_TRIBUTARIOS = ['Simples Nacional', 'Lucro Presumido', 'Lucro Real'] as const;

const cnpj = campo((valor: unknown) => {
    if (typeof valor !== 'string' || valor.trim() === '') return { erro: 'CNPJ é obrigatório.' };
    const digitos = normalizarCnpj(valor);
    return digitos ? { valor: digitos } : { erro: 'CNPJ inválido: confira os 14 dígitos.' };
});

export const dadosDaEmpresa = corpoEstrito({
    razao_social: texto('Razão social', 255),
    cnpj,
    regime_tributario: opcional(enumerado('Regime tributário', REGIMES_TRIBUTARIOS)),
});

// O que o schema entrega em req.dadosValidados. O tipo é escrito à mão: mude-o junto com o schema.
export interface DadosDaEmpresa {
    razao_social: string;
    cnpj: string;
    regime_tributario: typeof REGIMES_TRIBUTARIOS[number] | null;
}

