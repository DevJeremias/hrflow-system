const secret = process.env.JWT_SECRET;

if (typeof secret !== 'string' || secret.trim() === '') {
    throw new Error('A variável de ambiente JWT_SECRET é obrigatória e não pode estar vazia.');
}

module.exports = secret;
