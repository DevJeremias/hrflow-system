// Validação do avatar enviado como data URL em base64. O limite de tamanho é o mesmo que o
// formulário de perfil já aplica ao arquivo (2 MB); o formato é conferido pelo tipo declarado e
// pelos primeiros bytes da imagem, porque o tipo declarado sozinho é só texto do cliente.
const TAMANHO_MAXIMO_BYTES = 2 * 1024 * 1024;

const ASSINATURAS = {
    'image/png': (bytes) => bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    'image/jpeg': (bytes) => bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])),
    'image/gif': (bytes) => ['GIF87a', 'GIF89a'].includes(bytes.subarray(0, 6).toString('latin1')),
    'image/webp': (bytes) => bytes.subarray(0, 4).toString('latin1') === 'RIFF' && bytes.subarray(8, 12).toString('latin1') === 'WEBP',
};

const CABECALHO = /^data:([a-z]+\/[a-z0-9.+-]+);base64,/i;
const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/;
const FORMATOS = 'PNG, JPEG, WebP ou GIF';

// Devolve a mensagem de erro, ou null quando o avatar é aceitável.
const validarAvatar = (valor) => {
    if (typeof valor !== 'string') return 'O avatar deve ser uma imagem em data URL base64.';

    const cabecalho = CABECALHO.exec(valor.slice(0, 80));
    if (!cabecalho) return `O avatar deve ser uma imagem em data URL base64 (${FORMATOS}).`;

    const tipo = cabecalho[1].toLowerCase();
    if (!ASSINATURAS[tipo]) return `Formato de avatar não suportado (${tipo}). Use ${FORMATOS}.`;

    const base64 = valor.slice(cabecalho[0].length);
    if (base64.length === 0 || base64.length % 4 !== 0 || !BASE64.test(base64)) return 'O conteúdo do avatar não é um base64 válido.';

    const preenchimento = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
    if (base64.length / 4 * 3 - preenchimento > TAMANHO_MAXIMO_BYTES) {
        return `O avatar deve ter no máximo ${TAMANHO_MAXIMO_BYTES / 1024 / 1024} MB.`;
    }

    // Só os primeiros bytes importam para a assinatura: evita decodificar a imagem inteira.
    const inicio = Buffer.from(base64.slice(0, 32), 'base64');
    if (!ASSINATURAS[tipo](inicio)) return `O arquivo não é uma imagem ${tipo.slice(6).toUpperCase()} válida.`;

    return null;
};

module.exports = { TAMANHO_MAXIMO_BYTES, validarAvatar };
