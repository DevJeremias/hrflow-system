import { opcional, texto, email, telefone, senhaNova, corpo, campo, ausente } from '../../schemas/comum.js';
import { LIMITES } from '../../utils/validacaoAuth.js';
import { validarAvatar } from '../funcionarios/index.ts';

const avatar = campo((valor: unknown) => {
    const erro = validarAvatar(valor);
    return erro ? { erro } : { valor };
});

// A senha atual só é conferida contra o hash, então aceita qualquer texto até o limite do login.
const senhaAtual = campo((valor: unknown) => {
    if (ausente(valor)) return { erro: 'Informe a senha atual.' };
    if (typeof valor !== 'string') return { erro: 'A senha atual deve ser um texto.' };
    return valor.length > LIMITES.senhaLoginMax
        ? { erro: `A senha atual deve ter no máximo ${LIMITES.senhaLoginMax} caracteres.` }
        : { valor };
});

export const atualizarMeusDados = corpo({
    nome: texto('Nome', LIMITES.nome),
    email,
    telefone: opcional(telefone),
    avatar: opcional(avatar),
});

export const alterarSenha = corpo({ senhaAtual, novaSenha: senhaNova });

// O que cada schema entrega em req.dadosValidados. schemas/comum.js ainda é JavaScript e seus
// construtores não declaram o tipo que devolvem, então estes tipos são escritos à mão: mude-os
// junto com o schema.
export interface CorpoDeAtualizarMeusDados {
    nome: string;
    email: string;
    telefone: string | null;
    avatar: string | null;
}

export interface CorpoDeAlterarSenha {
    senhaAtual: string;
    novaSenha: string;
}
