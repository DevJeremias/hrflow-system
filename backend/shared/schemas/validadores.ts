// Regras de texto, e-mail e senha compartilhadas: a autenticação (modules/auth) e os schemas zod de
// shared/schemas/comum.ts as aplicam, para que cadastro, login e as demais rotas recusem a mesma
// entrada com a mesma mensagem. Os limites de tamanho seguem as colunas (VARCHAR(100) no README) e
// o bcrypt, que ignora em silêncio tudo que passa de 72 bytes da senha.
export const LIMITES = {
    nome: 100,
    email: 100,
    emailLoginMax: 255,
    senhaMin: 8,
    senhaMaxBytes: 72,
    senhaLoginMax: 128,
} as const;

const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CARACTERE_DE_CONTROLE = /[\u0000-\u001f\u007f]/;

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
