// Regras de funcionários: referências da mesma empresa, e-mail único, credencial de acesso criada
// junto e sessões derrubadas ao inativar. Não conhece HTTP (falhas de regra saem como
// ErroDeFuncionario) e só chega ao banco pelo repositório.
import bcrypt from 'bcrypt';
import * as repositorio from './funcionarios.repository.ts';
import type { FuncionarioListado, RepositorioDeFuncionarios } from './funcionarios.repository.ts';
import { ErroDeFuncionario } from './funcionarios.erros.ts';
import type { CorpoDaEdicao, CorpoDoCadastro, Paginacao } from './funcionarios.schemas.ts';
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

export interface PaginaDeFuncionarios {
    funcionarios: FuncionarioListado[];
    total: number;
}

export const listarFuncionarios = async (empresaId: number, paginacao: Paginacao): Promise<PaginaDeFuncionarios> => {
    const [limite, deslocamento] = limiteEDeslocamento(paginacao);
    const funcionarios = await repositorio.listarDaEmpresa(empresaId, limite, deslocamento);
    const total = await repositorio.contarDaEmpresa(empresaId);
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

        // Inativar derruba as sessões abertas; sem isso, reativar ressuscitaria tokens antigos.
        if (dados.status === 'Inativo') await repo.derrubarSessoes(id, empresaId);
    });
};

// Remove o acesso e o funcionário juntos.
export const deletarFuncionario = async (empresaId: number, id: number): Promise<void> => {
    await repositorio.emTransacao(async (repo) => {
        await repo.excluirUsuarios(id, empresaId);

        if (!await repo.excluirFuncionario(id, empresaId)) {
            throw new ErroDeFuncionario('inexistente', 'Funcionário não encontrado.');
        }
    });
};
