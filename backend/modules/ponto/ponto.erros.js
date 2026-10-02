// Falha de regra do ponto. O serviço diz o que deu errado (tipo e mensagem para o usuário) e o
// controlador traduz o tipo em status HTTP; o que não for ErroDePonto é falha inesperada.
class ErroDePonto extends Error {
    // tipo: 'proibido' | 'invalido' | 'inexistente' | 'conflito'. `detalhes` entra no corpo da resposta.
    constructor(tipo, mensagem, detalhes = {}) {
        super(mensagem);
        this.name = 'ErroDePonto';
        this.tipo = tipo;
        this.corpo = { erro: mensagem, ...detalhes };
    }
}

module.exports = { ErroDePonto };
