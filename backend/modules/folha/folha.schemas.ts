import { paginacao } from '../../shared/schemas/paginacao.js';

export const consultarFolha = paginacao;

// O que o schema entrega em req.dadosValidados. schemas/paginacao.js ainda é JavaScript e não
// declara o tipo que devolve, então este tipo é escrito à mão: mude-o junto com o schema.
export interface ConsultaDaFolha {
    pagina: number;
    limite: number;
}
