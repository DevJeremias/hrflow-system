// Falha de regra de funcionários. O serviço diz o que deu errado (tipo e mensagem para o usuário)
// e o controlador traduz o tipo em status HTTP; o que não for ErroDeFuncionario é falha inesperada.
export type TipoDeErro = 'invalido' | 'inexistente' | 'proibido';

export class ErroDeFuncionario extends Error {
    tipo: TipoDeErro;
    corpo: { erro: string } & Record<string, unknown>;

    // `detalhes` entra no corpo da resposta, ao lado da mensagem.
    constructor(tipo: TipoDeErro, mensagem: string, detalhes: Record<string, unknown> = {}) {
        super(mensagem);
        this.name = 'ErroDeFuncionario';
        this.tipo = tipo;
        this.corpo = { erro: mensagem, ...detalhes };
    }
}
