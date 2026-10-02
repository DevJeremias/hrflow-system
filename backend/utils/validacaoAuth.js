// Validação de entrada de login e cadastro. Roda antes de qualquer acesso ao banco.
// Os limites de tamanho seguem as colunas (VARCHAR(100) no README) e o bcrypt, que
// ignora em silêncio tudo que passa de 72 bytes da senha.
const LIMITES = {
    nome: 100,
    email: 100,
    emailLoginMax: 255,
    senhaMin: 8,
    senhaMaxBytes: 72,
    senhaLoginMax: 128,
};

const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CARACTERE_DE_CONTROLE = /[\u0000-\u001f\u007f]/;

const ehObjeto = (corpo) => corpo !== null && typeof corpo === 'object' && !Array.isArray(corpo);

const validarTexto = (valor, rotulo, maximo) => {
    if (typeof valor !== 'string') return `${rotulo} deve ser um texto.`;
    const texto = valor.trim();
    if (texto === '') return `${rotulo} é obrigatório.`;
    if (texto.length > maximo) return `${rotulo} deve ter no máximo ${maximo} caracteres.`;
    if (CARACTERE_DE_CONTROLE.test(texto)) return `${rotulo} contém caracteres inválidos.`;
    return null;
};

const validarEmail = (valor) => {
    const erro = validarTexto(valor, 'E-mail', LIMITES.email);
    if (erro) return erro;
    return EMAIL_VALIDO.test(valor.trim()) ? null : 'Informe um e-mail válido.';
};

const validarRegistro = (corpo) => {
    if (!ehObjeto(corpo)) return { erro: 'Envie os dados do cadastro em JSON.' };
    const { nomeEmpresa, nomeAdmin, email, senha } = corpo;

    const erro = validarTexto(nomeEmpresa, 'Nome da empresa', LIMITES.nome)
        || validarTexto(nomeAdmin, 'Nome do administrador', LIMITES.nome)
        || validarEmail(email)
        || validarSenhaDeRegistro(senha);
    if (erro) return { erro };

    return {
        dados: {
            nomeEmpresa: nomeEmpresa.trim(),
            nomeAdmin: nomeAdmin.trim(),
            email: email.trim().toLowerCase(),
            senha,
        },
    };
};

const validarSenhaDeRegistro = (senha) => {
    if (typeof senha !== 'string') return 'Senha deve ser um texto.';
    if (senha.length < LIMITES.senhaMin) return `A senha deve ter no mínimo ${LIMITES.senhaMin} caracteres.`;
    if (Buffer.byteLength(senha, 'utf8') > LIMITES.senhaMaxBytes) {
        return `A senha deve ter no máximo ${LIMITES.senhaMaxBytes} bytes (cerca de ${LIMITES.senhaMaxBytes} caracteres sem acentos).`;
    }
    return null;
};

// O login não aplica a política de cadastro (formato do e-mail, tamanho mínimo e máximo da
// senha): contas criadas antes dela, ou pelo cadastro de colaboradores, precisam continuar entrando.
const validarLogin = (corpo) => {
    if (!ehObjeto(corpo)) return { erro: 'Envie e-mail e senha em JSON.' };
    const { email, senha } = corpo;

    const erro = validarTexto(email, 'E-mail', LIMITES.emailLoginMax)
        || (typeof senha !== 'string' || senha === '' ? 'Informe a senha.' : null)
        || (senha.length > LIMITES.senhaLoginMax ? `A senha deve ter no máximo ${LIMITES.senhaLoginMax} caracteres.` : null);
    if (erro) return { erro };

    return { dados: { email: email.trim(), senha } };
};

module.exports = { LIMITES, validarRegistro, validarLogin };
