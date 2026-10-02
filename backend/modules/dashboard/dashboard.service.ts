// Monta o resumo da primeira tela do painel administrativo. "Hoje" é o dia de Belém, como no ponto.
import { relogio, diaLocal, limitesDoDia } from '../ponto/index.ts';
import * as repositorio from './dashboard.repository.ts';

export interface ResumoDoDashboard {
    colaboradoresAtivos: number;
    colaboradoresInativos: number;
    departamentos: number;
    cargos: number;
    marcacoesHoje: number;
}

// Ativo é todo colaborador que não foi desligado: quem está de férias continua na empresa e
// continua entrando no sistema (authMiddleware só barra Inativo).
export const resumoDaEmpresa = async (empresaId: number): Promise<ResumoDoDashboard> => {
    const { inicio, fim } = limitesDoDia(diaLocal(Math.floor(relogio.agora() / 1000)));
    const contagens = await repositorio.contagensDaEmpresa(empresaId, inicio, fim);
    return {
        colaboradoresAtivos: contagens.colaboradores_ativos,
        colaboradoresInativos: contagens.colaboradores_inativos,
        departamentos: contagens.departamentos,
        cargos: contagens.cargos,
        marcacoesHoje: contagens.marcacoes_hoje,
    };
};
