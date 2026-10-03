// Falha de regra da autenticação. O serviço diz o que deu errado (tipo e mensagem para o usuário)
// e o controlador traduz o tipo em status HTTP; o que não for ErroDeAuth é falha inesperada.
export type TipoDeErro = 'naoAutenticado' | 'proibido' | 'conflito';

export class ErroDeAuth extends Error {
    tipo: TipoDeErro;
    corpo: { erro: string };

    constructor(tipo: TipoDeErro, mensagem: string) {
        super(mensagem);
        this.name = 'ErroDeAuth';
        this.tipo = tipo;
        this.corpo = { erro: mensagem };
    }
}
