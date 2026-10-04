// Validação do anexo (atestado, boletim, comprovante), enviado como JSON com o conteúdo em base64.
// Aceita PDF, JPEG e PNG de até 5 MB. O tipo declarado sozinho é só texto do cliente: o formato é
// conferido também pelos primeiros bytes do arquivo.
export const TAMANHO_MAXIMO_DO_ANEXO = 5 * 1024 * 1024;

// Cinco megabytes viram 7 MB de base64. Com o dobro de folga, um anexo um pouco maior que o limite chega
// à validação e responde 400 com a mensagem do limite; só o absurdamente grande para no parser (413).
export const LIMITE_DO_CORPO_DE_AUSENCIAS = '14mb';

const NOME_MAXIMO = 255;

const ASSINATURAS: Record<string, (bytes: Buffer) => boolean> = {
    'application/pdf': (bytes) => bytes.subarray(0, 5).toString('latin1') === '%PDF-',
    'image/jpeg': (bytes) => bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])),
    'image/png': (bytes) => bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
};

export const TIPOS_DE_ANEXO = Object.keys(ASSINATURAS);

const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/;

export interface Anexo {
    nome: string;
    tipo: string;
    conteudo: Buffer;
}

type Resultado = { anexo: Anexo; erro?: undefined } | { erro: string; anexo?: undefined };

// O nome só serve de rótulo no download: sem caminho e sem caracteres de controle.
const nomeLimpo = (nome: string): string => nome.replace(/[\u0000-\u001f\u007f]/g, '').split(/[\\/]/).pop()!.trim();

export const validarAnexo = (valor: unknown): Resultado => {
    if (typeof valor !== 'object' || valor === null) return { erro: 'O anexo deve ser um objeto com nome, tipo e conteudo.' };
    const { nome, tipo, conteudo } = valor as { nome?: unknown; tipo?: unknown; conteudo?: unknown };

    if (typeof nome !== 'string' || nomeLimpo(nome) === '') return { erro: 'Informe o nome do arquivo anexado.' };
    if (nomeLimpo(nome).length > NOME_MAXIMO) return { erro: `O nome do arquivo deve ter no máximo ${NOME_MAXIMO} caracteres.` };

    if (typeof tipo !== 'string' || !TIPOS_DE_ANEXO.includes(tipo)) return { erro: 'O anexo deve ser um PDF, JPG ou PNG.' };

    if (typeof conteudo !== 'string' || conteudo.length === 0 || conteudo.length % 4 !== 0 || !BASE64.test(conteudo)) {
        return { erro: 'O conteúdo do anexo não é um base64 válido.' };
    }
    // O tamanho sai do texto, antes de decodificar: um arquivo grande demais não chega a ocupar memória.
    const preenchimento = conteudo.endsWith('==') ? 2 : conteudo.endsWith('=') ? 1 : 0;
    const bytes = conteudo.length / 4 * 3 - preenchimento;
    if (bytes > TAMANHO_MAXIMO_DO_ANEXO) return { erro: `O anexo deve ter no máximo ${TAMANHO_MAXIMO_DO_ANEXO / 1024 / 1024} MB.` };

    const arquivo = Buffer.from(conteudo, 'base64');
    if (!ASSINATURAS[tipo](arquivo)) return { erro: `O arquivo não é um ${tipo === 'application/pdf' ? 'PDF' : tipo.slice(6).toUpperCase()} válido.` };

    return { anexo: { nome: nomeLimpo(nome), tipo, conteudo: arquivo } };
};
