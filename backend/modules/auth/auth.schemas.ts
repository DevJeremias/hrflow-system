// Validação de entrada de login e cadastro. Roda antes de qualquer acesso ao banco.
//
// Não usa zod nem shared/middlewares/validarEntrada.ts: a resposta de 400 da autenticação é só
// { erro }, sem a lista `detalhes` que o validarEntrada acrescentaria. As regras de texto, e-mail
// e senha são as de shared/schemas/validadores.ts, que também valem para shared/schemas/comum.ts.
import { LIMITES, validarTexto, validarEmail, validarSenhaDeRegistro } from '../../shared/schemas/validadores.ts';

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

const ehObjeto = (corpo: unknown): corpo is Record<string, unknown> =>
    corpo !== null && typeof corpo === 'object' && !Array.isArray(corpo);

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
