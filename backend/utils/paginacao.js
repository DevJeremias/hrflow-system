// Limites de paginação definidos pela aplicação. As listagens devolvem um array (o contrato que
// o front-end já consome) e informam o total no cabeçalho X-Total-Count; sem parâmetros, devolvem
// a primeira página de LIMITE_PADRAO itens.
const LIMITE_PADRAO = 500;
const LIMITE_MAXIMO = 1000;
const PAGINA_MAXIMA = 1_000_000;

// Valores de LIMIT e OFFSET para a página já validada.
const limiteEDeslocamento = ({ pagina, limite }) => [limite, (pagina - 1) * limite];

const enviarPagina = (res, linhas, total) => {
    res.set('X-Total-Count', String(total));
    res.json(linhas);
};

module.exports = { LIMITE_PADRAO, LIMITE_MAXIMO, PAGINA_MAXIMA, limiteEDeslocamento, enviarPagina };
