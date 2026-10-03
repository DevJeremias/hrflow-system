import { opcional, texto, email, telefone, senhaNova, corpo, campo, ausente } from '../../shared/schemas/comum.ts';
import { LIMITES } from '../../shared/schemas/validadores.ts';
import { validarAvatar } from '../funcionarios/index.ts';

// Chave ausente mantém o avatar gravado (undefined); '' ou null o removem (null); o resto precisa ser
// uma imagem válida em data URL.
const avatar = campo((valor: unknown) => {
    if (valor === undefined) return { valor: undefined };
    if (ausente(valor)) return { valor: null };
    const erro = validarAvatar(valor);
    return erro ? { erro } : { valor: valor as string };
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
    avatar,
});

export const alterarSenha = corpo({ senhaAtual, novaSenha: senhaNova });

// O que cada schema entrega em req.dadosValidados. Os tipos são escritos à mão: mude-os junto com
// o schema.
export interface CorpoDeAtualizarMeusDados {
    nome: string;
    email: string;
    telefone: string | null;
    // undefined: manter; null: remover; texto: data URL da nova imagem.
    avatar?: string | null;
}

export interface CorpoDeAlterarSenha {
    senhaAtual: string;
    novaSenha: string;
}
