import { paginacao } from '../../shared/schemas/paginacao.ts';

export const consultarFolha = paginacao;

// O que o schema entrega em req.dadosValidados. O tipo é escrito à mão: mude-o junto com o schema.
export interface ConsultaDaFolha {
    pagina: number;
    limite: number;
}
