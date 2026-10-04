// Falha de regra dos relatórios. O serviço diz o que deu errado (tipo e mensagem para o usuário) e o
// controlador traduz o tipo em status HTTP; o que não for ErroDeRelatorio é falha inesperada.
export type TipoDeErro = 'invalido' | 'inexistente';

export class ErroDeRelatorio extends Error {
    tipo: TipoDeErro;
    corpo: { erro: string };

    constructor(tipo: TipoDeErro, mensagem: string) {
        super(mensagem);
        this.name = 'ErroDeRelatorio';
        this.tipo = tipo;
        this.corpo = { erro: mensagem };
    }
}
