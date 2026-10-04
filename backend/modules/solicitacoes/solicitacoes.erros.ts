// Falha de regra das solicitações de alteração cadastral. O serviço diz o que deu errado (tipo e
// mensagem para o usuário) e o controlador traduz o tipo em status HTTP; o que não for
// ErroDeSolicitacao é falha inesperada.
export type TipoDeErro = 'invalido' | 'proibido' | 'inexistente' | 'conflito';

export class ErroDeSolicitacao extends Error {
    tipo: TipoDeErro;
    corpo: { erro: string } & Record<string, unknown>;

    // `detalhes` entra no corpo da resposta, ao lado da mensagem.
    constructor(tipo: TipoDeErro, mensagem: string, detalhes: Record<string, unknown> = {}) {
        super(mensagem);
        this.name = 'ErroDeSolicitacao';
        this.tipo = tipo;
        this.corpo = { erro: mensagem, ...detalhes };
    }
}
