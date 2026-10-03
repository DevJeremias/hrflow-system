// A miniatura do avatar: o que as telas mostram e o que GET /api/perfil/avatar serve. O original
// (data URL de até 2 MB) fica guardado, mas não trafega.
import sharp from 'sharp';
import { ErroDePerfil } from './perfil.erros.ts';

export const LADO_DA_MINIATURA = 128;
export const TIPO_DA_MINIATURA = 'image/webp';

// Um arquivo de 2 MB pode declarar bilhões de pixels; o sharp recusa o que passar deste limite
// antes de decodificar.
const PIXELS_MAXIMOS = 40_000_000;

// Recorte quadrado centralizado, respeitando a orientação EXIF. A validação do avatar só confere o
// cabeçalho, então uma imagem corrompida só aparece aqui.
export const gerarMiniatura = async (dataUrl: string): Promise<Buffer> => {
    const original = Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');
    try {
        return await sharp(original, { limitInputPixels: PIXELS_MAXIMOS })
            .rotate()
            .resize(LADO_DA_MINIATURA, LADO_DA_MINIATURA, { fit: 'cover' })
            .webp({ quality: 80 })
            .toBuffer();
    } catch {
        throw new ErroDePerfil('invalido', 'Não foi possível processar a imagem do avatar. Envie outra foto (PNG, JPEG, WebP ou GIF).');
    }
};
