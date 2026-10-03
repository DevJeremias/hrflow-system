// Falha de regra de ausências. O serviço diz o que deu errado (tipo e mensagem para o usuário) e o
// controlador traduz o tipo em status HTTP; o que não for ErroDeAusencia é falha inesperada.
export type TipoDeErro = 'proibido' | 'invalido' | 'inexistente' | 'conflito';

export class ErroDeAusencia extends Error {
    tipo: TipoDeErro;
    corpo: { erro: string } & Record<string, unknown>;

    // `detalhes` entra no corpo da resposta, ao lado da mensagem.
    constructor(tipo: TipoDeErro, mensagem: string, detalhes: Record<string, unknown> = {}) {
        super(mensagem);
        this.name = 'ErroDeAusencia';
        this.tipo = tipo;
        this.corpo = { erro: mensagem, ...detalhes };
    }
}
