// Monta o resumo da primeira tela do painel administrativo. "Hoje" é o dia da empresa, como no ponto.
import { agoraEmSegundos } from '../../shared/utils/fuso.ts';
import { fusoDaEmpresa } from '../empresa/index.ts';
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
    const fuso = await fusoDaEmpresa(empresaId);
    const { inicio, fim } = fuso.limitesDoDia(fuso.diaLocal(agoraEmSegundos()));
    const contagens = await repositorio.contagensDaEmpresa(empresaId, inicio, fim);
    return {
        colaboradoresAtivos: contagens.colaboradores_ativos,
        colaboradoresInativos: contagens.colaboradores_inativos,
        departamentos: contagens.departamentos,
        cargos: contagens.cargos,
        marcacoesHoje: contagens.marcacoes_hoje,
    };
};
