// Falha de regra dos dados da empresa. O serviço diz o que deu errado e o controlador traduz o
// tipo em status HTTP; o que não for ErroDeEmpresa é falha inesperada.
export type TipoDeErro = 'inexistente' | 'conflito';

export class ErroDeEmpresa extends Error {
    tipo: TipoDeErro;
    corpo: { erro: string };

    constructor(tipo: TipoDeErro, mensagem: string) {
        super(mensagem);
        this.name = 'ErroDeEmpresa';
        this.tipo = tipo;
        this.corpo = { erro: mensagem };
    }
}
