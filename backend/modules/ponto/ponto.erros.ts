// Falha de regra do ponto. O serviço diz o que deu errado (tipo e mensagem para o usuário) e o
// controlador traduz o tipo em status HTTP; o que não for ErroDePonto é falha inesperada.
export type TipoDeErro = 'proibido' | 'invalido' | 'inexistente' | 'conflito';

export class ErroDePonto extends Error {
    tipo: TipoDeErro;
    corpo: { erro: string } & Record<string, unknown>;

    // `detalhes` entra no corpo da resposta, ao lado da mensagem.
    constructor(tipo: TipoDeErro, mensagem: string, detalhes: Record<string, unknown> = {}) {
        super(mensagem);
        this.name = 'ErroDePonto';
        this.tipo = tipo;
        this.corpo = { erro: mensagem, ...detalhes };
    }
}
