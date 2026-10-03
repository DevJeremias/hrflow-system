// Validação de entrada de login e cadastro. Roda antes de qualquer acesso ao banco.
//
// Não usa zod nem shared/middlewares/validarEntrada.ts: a resposta de 400 da autenticação é só
// { erro }, sem a lista `detalhes` que o validarEntrada acrescentaria. As regras de texto, e-mail
// e senha são as de shared/schemas/validadores.ts, que também valem para shared/schemas/comum.ts.
import { LIMITES, validarTexto, validarEmail, validarSenhaDeRegistro } from '../../shared/schemas/validadores.ts';
import { normalizarCnpj } from '../empresa/index.ts';

// Cada validador devolve { dados } quando aceita a entrada e { erro } com a mensagem para o
// usuário quando recusa.
export type Validacao<T> = { erro: string; dados?: undefined } | { dados: T; erro?: undefined };

// O que cada validador entrega em req.dadosValidados.body.
export interface DadosDeRegistro {
    nomeEmpresa: string;
    // Só os 14 dígitos.
    cnpj: string;
    nomeAdmin: string;
    email: string;
    senha: string;
}

export interface DadosDeLogin {
    email: string;
    senha: string;
}

export interface DadosDeEsqueciSenha {
    email: string;
}

export interface DadosDeRedefinicao {
    token: string;
    senha: string;
}

export const LINK_INVALIDO = 'Este link de redefinição é inválido ou expirou. Peça um novo.';

const ehObjeto = (corpo: unknown): corpo is Record<string, unknown> =>
    corpo !== null && typeof corpo === 'object' && !Array.isArray(corpo);

const validarCnpj = (cnpj: unknown): string | null => {
    if (typeof cnpj !== 'string' || cnpj.trim() === '') return 'CNPJ é obrigatório.';
    return normalizarCnpj(cnpj) ? null : 'CNPJ inválido: confira os 14 dígitos.';
};

const validarConfirmacao = (senha: unknown, confirmacao: unknown): string | null => {
    if (typeof confirmacao !== 'string' || confirmacao === '') return 'Confirme a senha.';
    return confirmacao === senha ? null : 'A confirmação da senha não confere.';
};

export const validarRegistro = (corpo: unknown): Validacao<DadosDeRegistro> => {
    if (!ehObjeto(corpo)) return { erro: 'Envie os dados do cadastro em JSON.' };
    const { nomeEmpresa, cnpj, nomeAdmin, email, senha, confirmacaoSenha } = corpo;

    const erro = validarTexto(nomeEmpresa, 'Nome da empresa', LIMITES.nome)
        || validarCnpj(cnpj)
        || validarTexto(nomeAdmin, 'Nome do administrador', LIMITES.nome)
        || validarEmail(email)
        || validarSenhaDeRegistro(senha)
        || validarConfirmacao(senha, confirmacaoSenha);
    if (erro) return { erro };

    return {
        dados: {
            nomeEmpresa: (nomeEmpresa as string).trim(),
            cnpj: normalizarCnpj(cnpj as string) as string,
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

export const validarEsqueciSenha = (corpo: unknown): Validacao<DadosDeEsqueciSenha> => {
    if (!ehObjeto(corpo)) return { erro: 'Envie o e-mail em JSON.' };
    const erro = validarEmail(corpo.email);
    if (erro) return { erro };
    return { dados: { email: (corpo.email as string).trim().toLowerCase() } };
};

// O token que o e-mail leva: 32 bytes aleatórios em base64url (43 caracteres).
export const FORMATO_DO_TOKEN = /^[A-Za-z0-9_-]{43}$/;

export const validarRedefinicao = (corpo: unknown): Validacao<DadosDeRedefinicao> => {
    if (!ehObjeto(corpo)) return { erro: 'Envie o token e a nova senha em JSON.' };
    const { token, senha } = corpo;
    if (typeof token !== 'string' || !FORMATO_DO_TOKEN.test(token)) return { erro: LINK_INVALIDO };
    const erro = validarSenhaDeRegistro(senha);
    if (erro) return { erro };
    return { dados: { token, senha: senha as string } };
};
