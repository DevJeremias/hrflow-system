const secret = process.env.JWT_SECRET;

if (typeof secret !== 'string' || secret.trim() === '') {
    throw new Error('A variável de ambiente JWT_SECRET é obrigatória e não pode estar vazia.');
}

if (Buffer.byteLength(secret, 'utf8') < 32) {
    throw new Error('A variável de ambiente JWT_SECRET deve ter pelo menos 32 bytes.');
}

module.exports = secret;
