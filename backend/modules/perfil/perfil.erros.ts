// Falha de regra do perfil. O serviço diz o que deu errado (tipo e mensagem para o usuário) e o
// controlador traduz o tipo em status HTTP; o que não for ErroDePerfil é falha inesperada.
export type TipoDeErro = 'invalido' | 'inexistente';

export class ErroDePerfil extends Error {
    tipo: TipoDeErro;

    constructor(tipo: TipoDeErro, mensagem: string) {
        super(mensagem);
        this.name = 'ErroDePerfil';
        this.tipo = tipo;
    }
}
