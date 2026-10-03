const { opcional, texto, email, telefone, senhaNova, corpo, campo, ausente } = require('./comum');
const { LIMITES } = require('../modules/auth/auth.schemas.ts');
const { validarAvatar } = require('../utils/validacaoAvatar');

const avatar = campo((valor) => {
    const erro = validarAvatar(valor);
    return erro ? { erro } : { valor };
});

// A senha atual só é conferida contra o hash, então aceita qualquer texto até o limite do login.
const senhaAtual = campo((valor) => {
    if (ausente(valor)) return { erro: 'Informe a senha atual.' };
    if (typeof valor !== 'string') return { erro: 'A senha atual deve ser um texto.' };
    return valor.length > LIMITES.senhaLoginMax
        ? { erro: `A senha atual deve ter no máximo ${LIMITES.senhaLoginMax} caracteres.` }
        : { valor };
});

module.exports = {
    atualizarMeusDados: corpo({
        nome: texto('Nome', LIMITES.nome),
        email,
        telefone: opcional(telefone),
        avatar: opcional(avatar),
    }),
    alterarSenha: corpo({ senhaAtual, novaSenha: senhaNova }),
};
