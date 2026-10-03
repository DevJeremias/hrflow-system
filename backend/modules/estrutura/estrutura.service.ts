// Regras da estrutura organizacional: o que pode ser criado, alterado e removido em departamentos e
// cargos. Não conhece HTTP (falhas de regra saem como ErroDeEstrutura) e só chega ao banco pelo
// repositório.
import * as repositorio from './estrutura.repository.ts';
import type { CargoListado, DepartamentoListado } from './estrutura.repository.ts';
import { ErroDeEstrutura } from './estrutura.erros.ts';
import type { DadosDoCargo, DadosDoDepartamento } from './estrutura.schemas.ts';
import { limiteEDeslocamento } from '../../shared/utils/paginacao.ts';

export interface Pagina<T> {
    registros: T[];
    total: number;
}

interface Consulta {
    pagina: number;
    limite: number;
}

const DEPARTAMENTO_NAO_ENCONTRADO = 'Departamento não encontrado.';
const CARGO_NAO_ENCONTRADO = 'Cargo não encontrado.';
const DEPARTAMENTO_DUPLICADO = 'Já existe um departamento com este nome nesta empresa.';
const CARGO_DUPLICADO = 'Já existe um cargo com este nome neste departamento.';

// Nome de departamento é único por empresa e o de cargo, por departamento (chaves do banco): quem
// perde a corrida entre dois cadastros iguais recebe a mesma resposta de quem repetiu o nome.
const recusarDuplicidade = (mensagem: string) => (erro: unknown): never => {
    if ((erro as { code?: string }).code === 'ER_DUP_ENTRY') throw new ErroDeEstrutura('conflito', mensagem);
    throw erro;
};

// O departamento de um cargo precisa ser da mesma empresa de quem opera.
const exigirDepartamentoDaEmpresa = async (departamentoId: number, empresaId: number): Promise<void> => {
    if (!(await repositorio.departamentoExiste(departamentoId, empresaId))) {
        throw new ErroDeEstrutura('invalido', 'Departamento não encontrado nesta empresa.');
    }
};

// ==========================================
// DEPARTAMENTOS
// ==========================================

export const listarDepartamentos = async (empresaId: number, consulta: Consulta): Promise<Pagina<DepartamentoListado>> => {
    const [limite, deslocamento] = limiteEDeslocamento(consulta);
    const registros = await repositorio.listarDepartamentos(empresaId, limite, deslocamento);
    return { registros, total: await repositorio.contarDepartamentos(empresaId) };
};

export const criarDepartamento = (empresaId: number, dados: DadosDoDepartamento): Promise<void> =>
    repositorio.criarDepartamento(empresaId, dados).catch(recusarDuplicidade(DEPARTAMENTO_DUPLICADO));

export const atualizarDepartamento = async (id: number, empresaId: number, dados: DadosDoDepartamento): Promise<void> => {
    if (!(await repositorio.atualizarDepartamento(id, empresaId, dados).catch(recusarDuplicidade(DEPARTAMENTO_DUPLICADO)))) {
        throw new ErroDeEstrutura('inexistente', DEPARTAMENTO_NAO_ENCONTRADO);
    }
};

export const removerDepartamento = async (id: number, empresaId: number): Promise<void> => {
    if (!(await repositorio.departamentoExiste(id, empresaId))) throw new ErroDeEstrutura('inexistente', DEPARTAMENTO_NAO_ENCONTRADO);
    if (await repositorio.departamentoTemCargos(id, empresaId)) {
        throw new ErroDeEstrutura('invalido', 'Não é possível excluir um departamento que possui cargos associados.');
    }
    if (!(await repositorio.removerDepartamento(id, empresaId))) throw new ErroDeEstrutura('inexistente', DEPARTAMENTO_NAO_ENCONTRADO);
};

// ==========================================
// CARGOS
// ==========================================

export const listarCargos = async (empresaId: number, consulta: Consulta): Promise<Pagina<CargoListado>> => {
    const [limite, deslocamento] = limiteEDeslocamento(consulta);
    const registros = await repositorio.listarCargos(empresaId, limite, deslocamento);
    return { registros, total: await repositorio.contarCargos(empresaId) };
};

export const criarCargo = async (empresaId: number, dados: DadosDoCargo): Promise<void> => {
    await exigirDepartamentoDaEmpresa(dados.departamento_id, empresaId);
    await repositorio.criarCargo(empresaId, dados).catch(recusarDuplicidade(CARGO_DUPLICADO));
};

export const atualizarCargo = async (id: number, empresaId: number, dados: DadosDoCargo): Promise<void> => {
    await exigirDepartamentoDaEmpresa(dados.departamento_id, empresaId);
    if (!(await repositorio.atualizarCargo(id, empresaId, dados).catch(recusarDuplicidade(CARGO_DUPLICADO)))) throw new ErroDeEstrutura('inexistente', CARGO_NAO_ENCONTRADO);
};

export const removerCargo = async (id: number, empresaId: number): Promise<void> => {
    if (!(await repositorio.cargoExiste(id, empresaId))) throw new ErroDeEstrutura('inexistente', CARGO_NAO_ENCONTRADO);
    if (await repositorio.cargoTemOcupantesAtivos(id, empresaId)) {
        throw new ErroDeEstrutura('invalido', 'Não é possível remover este cargo porque existem colaboradores ativos alocados nele.');
    }
    if (!(await repositorio.removerCargo(id, empresaId))) throw new ErroDeEstrutura('inexistente', CARGO_NAO_ENCONTRADO);
};
