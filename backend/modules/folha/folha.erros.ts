// Falha de regra da folha. O serviço diz o que deu errado (tipo e mensagem para o usuário) e o
// controlador traduz o tipo em status HTTP; o que não for ErroDeFolha é falha inesperada.
export type TipoDeErro = 'invalido' | 'inexistente' | 'conflito' | 'incompleto';

export class ErroDeFolha extends Error {
    tipo: TipoDeErro;
    corpo: { erro: string };

    constructor(tipo: TipoDeErro, mensagem: string) {
        super(mensagem);
        this.name = 'ErroDeFolha';
        this.tipo = tipo;
        this.corpo = { erro: mensagem };
    }
}
