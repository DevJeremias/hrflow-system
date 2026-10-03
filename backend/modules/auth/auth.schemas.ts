// Validação de entrada de login e cadastro. Roda antes de qualquer acesso ao banco.
// Os limites de tamanho seguem as colunas (VARCHAR(100) no README) e o bcrypt, que
// ignora em silêncio tudo que passa de 72 bytes da senha.
//
// Não usa zod nem shared/middlewares/validarEntrada.ts: a resposta de 400 da autenticação é só
// { erro }, sem a lista `detalhes` que o validarEntrada acrescentaria. As regras de texto, e-mail
// e senha também valem para shared/schemas/comum.ts, que as importa daqui.
export const LIMITES = {
    nome: 100,
    email: 100,
    emailLoginMax: 255,
    senhaMin: 8,
    senhaMaxBytes: 72,
    senhaLoginMax: 128,
} as const;

// Cada validador devolve { dados } quando aceita a entrada e { erro } com a mensagem para o
// usuário quando recusa.
export type Validacao<T> = { erro: string; dados?: undefined } | { dados: T; erro?: undefined };

// O que cada validador entrega em req.dadosValidados.body.
export interface DadosDeRegistro {
    nomeEmpresa: string;
    nomeAdmin: string;
    email: string;
    senha: string;
}

export interface DadosDeLogin {
    email: string;
    senha: string;
}

const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CARACTERE_DE_CONTROLE = /[\u0000-\u001f\u007f]/;

const ehObjeto = (corpo: unknown): corpo is Record<string, unknown> =>
    corpo !== null && typeof corpo === 'object' && !Array.isArray(corpo);

export const validarTexto = (valor: unknown, rotulo: string, maximo: number): string | null => {
    if (typeof valor !== 'string') return `${rotulo} deve ser um texto.`;
    const texto = valor.trim();
    if (texto === '') return `${rotulo} é obrigatório.`;
    if (texto.length > maximo) return `${rotulo} deve ter no máximo ${maximo} caracteres.`;
    if (CARACTERE_DE_CONTROLE.test(texto)) return `${rotulo} contém caracteres inválidos.`;
    return null;
};

export const validarEmail = (valor: unknown): string | null => {
    const erro = validarTexto(valor, 'E-mail', LIMITES.email);
    if (erro) return erro;
    return EMAIL_VALIDO.test((valor as string).trim()) ? null : 'Informe um e-mail válido.';
};

export const validarSenhaDeRegistro = (senha: unknown): string | null => {
    if (typeof senha !== 'string') return 'Senha deve ser um texto.';
    if (senha.length < LIMITES.senhaMin) return `A senha deve ter no mínimo ${LIMITES.senhaMin} caracteres.`;
    if (Buffer.byteLength(senha, 'utf8') > LIMITES.senhaMaxBytes) {
        return `A senha deve ter no máximo ${LIMITES.senhaMaxBytes} bytes (cerca de ${LIMITES.senhaMaxBytes} caracteres sem acentos).`;
    }
    return null;
};

export const validarRegistro = (corpo: unknown): Validacao<DadosDeRegistro> => {
    if (!ehObjeto(corpo)) return { erro: 'Envie os dados do cadastro em JSON.' };
    const { nomeEmpresa, nomeAdmin, email, senha } = corpo;

    const erro = validarTexto(nomeEmpresa, 'Nome da empresa', LIMITES.nome)
        || validarTexto(nomeAdmin, 'Nome do administrador', LIMITES.nome)
        || validarEmail(email)
        || validarSenhaDeRegistro(senha);
    if (erro) return { erro };

    return {
        dados: {
            nomeEmpresa: (nomeEmpresa as string).trim(),
            nomeAdmin: (nomeAdmin as string).trim(),
            email: (email as string).trim().toLowerCase(),
            senha: senha as string,
        },
    };
};

// O login não aplica a política de cadastro (formato do e-mail, tamanho mínimo e máximo da
// senha): contas criadas antes dela, ou pelo cadastro de colaboradores, precisam continuar entrando.
const validarSenhaDeLogin = (senha: unknown): string | null => {
    if (typeof senha !== 'string' || senha === '') return 'Informe a senha.';
    return senha.length > LIMITES.senhaLoginMax ? `A senha deve ter no máximo ${LIMITES.senhaLoginMax} caracteres.` : null;
};

export const validarLogin = (corpo: unknown): Validacao<DadosDeLogin> => {
    if (!ehObjeto(corpo)) return { erro: 'Envie e-mail e senha em JSON.' };
    const { email, senha } = corpo;

    const erro = validarTexto(email, 'E-mail', LIMITES.emailLoginMax) || validarSenhaDeLogin(senha);
    if (erro) return { erro };

    return { dados: { email: (email as string).trim(), senha: senha as string } };
};
