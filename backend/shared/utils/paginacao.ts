import type { Response } from 'express';

// Limites de paginação definidos pela aplicação. As listagens devolvem um array (o contrato que
// o front-end já consome) e informam o total no cabeçalho X-Total-Count; sem parâmetros, devolvem
// a primeira página de LIMITE_PADRAO itens.
export const LIMITE_PADRAO = 500;
export const LIMITE_MAXIMO = 1000;
export const PAGINA_MAXIMA = 1_000_000;

// Valores de LIMIT e OFFSET para a página já validada.
export const limiteEDeslocamento = ({ pagina, limite }: { pagina: number; limite: number }): [number, number] =>
    [limite, (pagina - 1) * limite];

export const enviarPagina = (res: Response, linhas: unknown[], total: number) => {
    res.set('X-Total-Count', String(total));
    res.json(linhas);
};
