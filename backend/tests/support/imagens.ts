import sharp from 'sharp';

// Imagens mínimas, só com a assinatura do formato: bastam para o que validarAvatar confere, mas
// não decodificam. Quem grava o avatar de verdade (a miniatura é gerada no upload) usa imagemReal.
const ASSINATURAS: Record<string, Buffer> = {
    png: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    jpeg: Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
    gif: Buffer.from('GIF89a', 'latin1'),
    webp: Buffer.concat([Buffer.from('RIFF', 'latin1'), Buffer.alloc(4), Buffer.from('WEBP', 'latin1')]),
};

// data URL do formato, com `bytes` bytes decodificados no total.
export const dataUrl = (formato: string, bytes = 64, tipo: string = formato) => {
    const corpo = Buffer.concat([ASSINATURAS[formato], Buffer.alloc(Math.max(0, bytes - ASSINATURAS[formato].length), 1)]);
    return `data:image/${tipo};base64,${corpo.toString('base64')}`;
};


// data URL de uma imagem que decodifica de verdade, quadrada, com `lado` pixels.
export const imagemReal = async (formato: 'png' | 'jpeg' | 'webp' = 'png', lado = 32): Promise<string> => {
    const bytes = await sharp({ create: { width: lado, height: lado, channels: 3, background: '#336699' } }).toFormat(formato).toBuffer();
    return `data:image/${formato};base64,${bytes.toString('base64')}`;
};
