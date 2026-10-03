// Falha de regra da estrutura organizacional. O serviço diz o que deu errado (tipo e mensagem para
// o usuário) e o controlador traduz o tipo em status HTTP; o que não for ErroDeEstrutura é falha
// inesperada.
export type TipoDeErro = 'invalido' | 'inexistente' | 'conflito';

export class ErroDeEstrutura extends Error {
    tipo: TipoDeErro;
    corpo: { erro: string };

    constructor(tipo: TipoDeErro, mensagem: string) {
        super(mensagem);
        this.name = 'ErroDeEstrutura';
        this.tipo = tipo;
        this.corpo = { erro: mensagem };
    }
}
