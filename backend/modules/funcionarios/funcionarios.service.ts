// Regras de funcionários: referências da mesma empresa, e-mail único, credencial de acesso criada
// junto, e o ciclo de vida (inativar ou desligar com data e motivo, reativar, redefinir a senha,
// excluir só o cadastro sem movimento). Não conhece HTTP (falhas de regra saem como
// ErroDeFuncionario) e só chega ao banco pelo repositório.
import bcrypt from 'bcrypt';
import * as repositorio from './funcionarios.repository.ts';
import type { AlvoDoCicloDeVida, FuncionarioListado, RepositorioDeFuncionarios } from './funcionarios.repository.ts';
import { ErroDeFuncionario } from './funcionarios.erros.ts';
import { gerarSenhaProvisoria } from './funcionarios.regras.ts';
import type { CorpoDaEdicao, CorpoDoCadastro, CorpoDoStatus, ConsultaDeFuncionarios } from './funcionarios.schemas.ts';
import { EMAIL_DUPLICADO } from '../../shared/utils/erros.ts';
import { limiteEDeslocamento } from '../../shared/utils/paginacao.ts';

const VOLTAS_DO_HASH = 10;

// Cargo e departamento chegam do cliente e não carregam empresa: só valem os da empresa de quem opera.
const exigirReferencias = async (repo: RepositorioDeFuncionarios, cargoId: number | null, departamentoId: number | null, empresaId: number): Promise<void> => {
    if (cargoId && !(await repo.cargoDaEmpresa(cargoId, empresaId))) {
        throw new ErroDeFuncionario('invalido', 'Cargo não encontrado nesta empresa.');
    }
    if (departamentoId && !(await repo.departamentoDaEmpresa(departamentoId, empresaId))) {
        throw new ErroDeFuncionario('invalido', 'Departamento não encontrado nesta empresa.');
    }
};

// Quem opera a ação, como o token o descreve.
export interface Ator {
    perfil: string;
    funcionarioId: number | null;
}

export type FuncionarioDaPagina = Omit<FuncionarioListado, 'tem_movimento'> & { tem_movimento: boolean };

export interface PaginaDeFuncionarios {
    funcionarios: FuncionarioDaPagina[];
    total: number;
}

export const listarFuncionarios = async (empresaId: number, { busca, status, departamento_id, ...paginacao }: ConsultaDeFuncionarios): Promise<PaginaDeFuncionarios> => {
    const [limite, deslocamento] = limiteEDeslocamento(paginacao);
    const filtros = { busca, status, departamento_id };
    const linhas = await repositorio.listarDaEmpresa(empresaId, filtros, limite, deslocamento);
    const funcionarios = linhas.map((linha) => ({ ...linha, tem_movimento: Boolean(linha.tem_movimento) }));
    const total = await repositorio.contarDaEmpresa(empresaId, filtros);
    return { funcionarios, total };
};

// Cria o funcionário (sempre Ativo) e o acesso dele como Colaborador, ou nenhum dos dois.
export const criarFuncionario = async (empresaId: number, { senha, ...dados }: CorpoDoCadastro): Promise<void> => {
    await repositorio.emTransacao(async (repo) => {
        await exigirReferencias(repo, dados.cargo_id, dados.departamento_id, empresaId);

        if (await repo.emailEmUso(dados.email)) {
            throw new ErroDeFuncionario('invalido', EMAIL_DUPLICADO, { detalhes: [{ campo: 'email', mensagem: EMAIL_DUPLICADO }] });
        }

        const funcionarioId = await repo.inserirFuncionario({ ...dados, empresaId });
        const senhaCriptografada = await bcrypt.hash(senha, VOLTAS_DO_HASH);
        await repo.inserirUsuarioColaborador({ nome: dados.nome, email: dados.email, senhaCriptografada, empresaId, funcionarioId });
    });
};

export const atualizarFuncionario = async (empresaId: number, id: number, dados: CorpoDaEdicao): Promise<void> => {
    await repositorio.emTransacao(async (repo) => {
        await exigirReferencias(repo, dados.cargo_id, dados.departamento_id, empresaId);

        if (!await repo.atualizarFuncionario({ ...dados, id, empresaId })) {
            throw new ErroDeFuncionario('inexistente', 'Funcionário não encontrado.');
        }

        await repo.sincronizarUsuario(id, empresaId, dados.nome, dados.email);
    });
};

// Carrega o alvo de uma ação do ciclo de vida e confere se quem opera pode agir sobre ele. O RH
// gere colaboradores, não o cadastro de outro RH ou Administrador, e ninguém age sobre si mesmo
// aqui: a senha própria se troca no perfil.
const alvoPermitido = async (repo: RepositorioDeFuncionarios, empresaId: number, id: number, ator: Ator, acao: string): Promise<AlvoDoCicloDeVida> => {
    const alvo = await repo.alvoDoCicloDeVida(id, empresaId);
    if (!alvo) throw new ErroDeFuncionario('inexistente', 'Funcionário não encontrado.');
    if (ator.funcionarioId === id) {
        throw new ErroDeFuncionario('proibido', `Você não pode ${acao} do seu próprio cadastro.`);
    }
    if (ator.perfil === 'RH' && alvo.usuario_perfil !== null && alvo.usuario_perfil !== 'Colaborador') {
        throw new ErroDeFuncionario('proibido', `O RH não pode ${acao} de outro RH ou Administrador.`);
    }
    return alvo;
};

export interface SituacaoDoFuncionario {
    status: CorpoDoStatus['status'];
    data_desligamento: string | null;
    motivo_desligamento: string | null;
}

// Inativar é desligar: grava data e motivo, derruba as sessões abertas e bloqueia o login, sem
// apagar nada. Reativar (ou pôr de férias) limpa a data e o motivo. O histórico fica no ponto.
export const alterarStatus = async (empresaId: number, id: number, ator: Ator, corpo: CorpoDoStatus): Promise<SituacaoDoFuncionario> => {
    return repositorio.emTransacao(async (repo) => {
        const alvo = await alvoPermitido(repo, empresaId, id, ator, 'alterar a situação');
        const inativando = corpo.status === 'Inativo';

        if (inativando && alvo.data_admissao && corpo.data_desligamento && corpo.data_desligamento < alvo.data_admissao) {
            throw new ErroDeFuncionario('invalido', 'A data do desligamento não pode ser anterior à data de admissão.', {
                detalhes: [{ campo: 'data_desligamento', mensagem: 'A data do desligamento não pode ser anterior à data de admissão.' }],
            });
        }

        await repo.atualizarStatus({
            id,
            empresaId,
            status: corpo.status,
            dataDoDesligamento: inativando ? corpo.data_desligamento : null,
            motivoDoDesligamento: inativando ? corpo.motivo_desligamento : null,
        });
        // Sem isto, reativar ressuscitaria os tokens emitidos antes da inativação.
        if (inativando) await repo.derrubarSessoes(id, empresaId);

        return {
            status: corpo.status,
            data_desligamento: inativando ? corpo.data_desligamento : null,
            motivo_desligamento: inativando ? corpo.motivo_desligamento : null,
        };
    });
};

// A senha provisória é devolvida aqui e em nenhum outro lugar: o banco guarda só o hash.
export const redefinirSenha = async (empresaId: number, id: number, ator: Ator): Promise<string> => {
    const senhaProvisoria = gerarSenhaProvisoria();
    const senhaCriptografada = await bcrypt.hash(senhaProvisoria, VOLTAS_DO_HASH);

    await repositorio.emTransacao(async (repo) => {
        const alvo = await alvoPermitido(repo, empresaId, id, ator, 'redefinir a senha');
        if (alvo.usuario_id === null) throw new ErroDeFuncionario('inexistente', 'Este colaborador não tem acesso ao sistema.');
        if (alvo.status === 'Inativo') {
            throw new ErroDeFuncionario('conflito', 'Reative o colaborador antes de redefinir a senha: o acesso dele está desativado.');
        }
        await repo.definirSenhaProvisoria(alvo.usuario_id, senhaCriptografada);
    });
    return senhaProvisoria;
};

// Só o cadastro sem movimento pode ser apagado (o engano de digitação, por exemplo). Quem já
// marcou ponto ou justificou um dia é inativado: a exclusão levaria o histórico junto.
export const deletarFuncionario = async (empresaId: number, id: number): Promise<void> => {
    await repositorio.emTransacao(async (repo) => {
        const alvo = await repo.alvoDoCicloDeVida(id, empresaId);
        if (!alvo) throw new ErroDeFuncionario('inexistente', 'Funcionário não encontrado.');

        if (await repo.temMovimento(id)) {
            throw new ErroDeFuncionario('conflito', 'Este colaborador tem registros de ponto e não pode ser excluído. Inative-o para preservar o histórico.');
        }

        await repo.excluirUsuarios(id, empresaId);
        await repo.excluirFuncionario(id, empresaId);
    });
};
