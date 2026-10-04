// Regras de funcionários: referências da mesma empresa, e-mail único, credencial de acesso criada
// junto, e o ciclo de vida (inativar ou desligar com data e motivo, reativar, redefinir a senha,
// excluir só o cadastro sem movimento). Toda mudança entra na trilha de auditoria e as de salário,
// cargo e departamento no histórico contratual, na mesma transação. Não conhece HTTP (falhas de regra
// saem como ErroDeFuncionario) e só chega ao banco pelo repositório.
import bcrypt from 'bcrypt';
import type { RowDataPacket } from 'mysql2/promise';
import * as repositorio from './funcionarios.repository.ts';
import type { AlvoDoCicloDeVida, DependenteGravado, FuncionarioListado, PeriodoContratual, RepositorioDeFuncionarios } from './funcionarios.repository.ts';
import { COLUNAS_AUDITADAS } from './funcionarios.repository.ts';
import { ErroDeFuncionario } from './funcionarios.erros.ts';
import { gerarSenhaProvisoria } from './funcionarios.regras.ts';
import { lerPlanilha, resolverReferencias } from './funcionarios.importacao.ts';
import { criarFuncionario as schemaDoCadastro } from './funcionarios.schemas.ts';
import type { CorpoDaEdicao, CorpoDoCadastro, CorpoDoDependente, CorpoDoStatus, ConsultaDeFuncionarios } from './funcionarios.schemas.ts';
import { diferencas } from '../../shared/utils/auditar.ts';
import type { Autoria } from '../../shared/utils/auditar.ts';
import { EMAIL_DUPLICADO, traduzirErro } from '../../shared/utils/erros.ts';
import { hojeDaEmpresa } from '../ausencias/index.ts';
import { limiteEDeslocamento } from '../../shared/utils/paginacao.ts';
import logger from '../../shared/observabilidade/logger.ts';
import { registrarNoSentry } from '../../shared/observabilidade/sentry.ts';
import { motivoDeNegacaoDoCadastro } from '../../shared/utils/permissoes.ts';
import { hoje } from '../../shared/utils/relogio.ts';

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

// Os dados pessoais de um cadastro anonimizado já foram apagados: não há o que editar nem a quem dar acesso.
const exigirNaoAnonimizado = (alvo: AlvoDoCicloDeVida): void => {
    if (alvo.anonimizado_em) throw new ErroDeFuncionario('conflito', 'Este cadastro foi anonimizado a pedido do titular e não pode mais ser alterado.');
};

// Editar ou excluir o cadastro segue a matriz de shared/utils/permissoes.ts: o RH não alcança o
// próprio cadastro nem o de RH ou Administrador; o Administrador alcança todos. Um cadastro que não
// existe responde 404 antes de qualquer recusa.
const exigirAlcance = async (repo: RepositorioDeFuncionarios, empresaId: number, id: number, ator: Ator): Promise<AlvoDoCicloDeVida> => {
    const alvo = await repo.alvoDoCicloDeVida(id, empresaId);
    if (!alvo) throw new ErroDeFuncionario('inexistente', 'Funcionário não encontrado.');

    const motivo = motivoDeNegacaoDoCadastro({ perfil: ator.perfil, funcionario_id: ator.funcionarioId }, { id, perfilDaConta: alvo.usuario_perfil });
    if (motivo) throw new ErroDeFuncionario('proibido', motivo);
    exigirNaoAnonimizado(alvo);
    return alvo;
};

// CPF e matrícula são únicos por empresa (chaves do banco): a corrida entre dois cadastros iguais
// termina aqui, com a mensagem do campo, e não num 500. Outras falhas seguem como vieram.
const DUPLICIDADES = [
    { chave: 'uq_funcionarios_empresa_cpf', campo: 'cpf', mensagem: 'Já existe um colaborador com este CPF nesta empresa.' },
    { chave: 'uq_funcionarios_empresa_matricula', campo: 'matricula', mensagem: 'Já existe um colaborador com esta matrícula nesta empresa.' },
];

const traduzirDuplicidade = (erro: unknown): never => {
    const { code, sqlMessage } = erro as { code?: string; sqlMessage?: string };
    const duplicidade = code === 'ER_DUP_ENTRY' ? DUPLICIDADES.find(({ chave }) => sqlMessage?.includes(chave)) : undefined;
    if (!duplicidade) throw erro;
    throw new ErroDeFuncionario('conflito', duplicidade.mensagem, { detalhes: [{ campo: duplicidade.campo, mensagem: duplicidade.mensagem }] });
};

export type FuncionarioDaPagina = Omit<FuncionarioListado, 'tem_movimento' | 'anonimizado'> & { tem_movimento: boolean; anonimizado: boolean };

export interface PaginaDeFuncionarios {
    funcionarios: FuncionarioDaPagina[];
    total: number;
}

export const listarFuncionarios = async (empresaId: number, { busca, status, departamento_id, ...paginacao }: ConsultaDeFuncionarios): Promise<PaginaDeFuncionarios> => {
    const [limite, deslocamento] = limiteEDeslocamento(paginacao);
    const filtros = { busca, status, departamento_id };
    const hoje = await hojeDaEmpresa(empresaId);
    const linhas = await repositorio.listarDaEmpresa(empresaId, filtros, hoje, limite, deslocamento);
    const funcionarios = linhas.map((linha) => ({ ...linha, tem_movimento: Boolean(linha.tem_movimento), anonimizado: Boolean(linha.anonimizado) }));
    const total = await repositorio.contarDaEmpresa(empresaId, filtros, hoje);
    return { funcionarios, total };
};

// Cria o funcionário (sempre Ativo) e o acesso dele como Colaborador, ou nenhum dos dois.
const gravarCadastro = (empresaId: number, autoria: Autoria, dados: Omit<CorpoDoCadastro, 'senha'>, senhaCriptografada: string): Promise<void> =>
    repositorio.emTransacao(async (repo) => {
        await exigirReferencias(repo, dados.cargo_id, dados.departamento_id, empresaId);

        if (await repo.emailEmUso(dados.email)) {
            throw new ErroDeFuncionario('invalido', EMAIL_DUPLICADO, { detalhes: [{ campo: 'email', mensagem: EMAIL_DUPLICADO }] });
        }

        const funcionarioId = await repo.inserirFuncionario({ ...dados, empresaId }).catch(traduzirDuplicidade);
        await repo.inserirUsuarioColaborador({ nome: dados.nome, email: dados.email, senhaCriptografada, empresaId, funcionarioId });

        await registrarVigencia(repo, { empresaId, funcionarioId, salario: dados.salario_base ?? null, cargoId: dados.cargo_id ?? null, departamentoId: dados.departamento_id ?? null, inicio: dados.data_admissao ?? hoje(), autoria });
        await repo.auditar(autoria, {
            acao: 'funcionario.criado',
            entidade: 'funcionario',
            entidadeId: funcionarioId,
            depois: {
                nome: dados.nome,
                email: dados.email,
                tipo_contrato: dados.tipo_contrato ?? null,
                salario_base: dados.salario_base ?? null,
                cargo: dados.cargo_id ? await repo.nomeDoCargo(dados.cargo_id, empresaId) : null,
                departamento: dados.departamento_id ? await repo.nomeDoDepartamento(dados.departamento_id, empresaId) : null,
            },
        });
    });

export const criarFuncionario = async (empresaId: number, autoria: Autoria, { senha, ...dados }: CorpoDoCadastro): Promise<void> =>
    gravarCadastro(empresaId, autoria, dados, await bcrypt.hash(senha, VOLTAS_DO_HASH));

interface Vigencia {
    empresaId: number;
    funcionarioId: number;
    salario: number | string | null;
    cargoId: number | null;
    departamentoId: number | null;
    // Dia em que a situação passa a valer, se ainda não há histórico.
    inicio: string;
    autoria: Autoria;
}

const diaAnterior = (dia: string): string => {
    const anterior = new Date(`${dia}T00:00:00Z`);
    anterior.setUTCDate(anterior.getUTCDate() - 1);
    return anterior.toISOString().slice(0, 10);
};

const mesmoPeriodo = (aberto: PeriodoContratual, { salario, cargoId, departamentoId }: Vigencia): boolean => {
    const mesmoSalario = aberto.salario_base === null || salario === null ? aberto.salario_base === salario : Number(aberto.salario_base) === Number(salario);
    return mesmoSalario && aberto.cargo_id === cargoId && aberto.departamento_id === departamentoId;
};

// Mantém o histórico contratual igual ao cadastro: mudar salário, cargo ou departamento fecha o período
// em vigor (no dia anterior) e abre outro a partir de hoje; no mesmo dia, o período aberto é corrigido
// no lugar. Sem período aberto (cadastro anterior ao histórico), abre o primeiro.
const registrarVigencia = async (repo: RepositorioDeFuncionarios, vigencia: Vigencia): Promise<void> => {
    const { empresaId, funcionarioId, salario, cargoId, departamentoId, inicio, autoria } = vigencia;
    const aberto = await repo.periodoAberto(funcionarioId);
    const dados = { salario, cargoId, departamentoId, registradoPor: autoria.usuarioId };
    if (!aberto) return repo.abrirPeriodo({ empresaId, funcionarioId, inicio, ...dados });
    if (mesmoPeriodo(aberto, vigencia)) return;

    const dia = hoje();
    if (aberto.vigencia_inicio >= dia) return repo.corrigirPeriodo(aberto.id, empresaId, dados);
    await repo.fecharPeriodo(aberto.id, diaAnterior(dia));
    await repo.abrirPeriodo({ empresaId, funcionarioId, inicio: dia, ...dados });
};

// Altera só os campos enviados: o que faltou no corpo fica como está.
export const atualizarFuncionario = async (empresaId: number, id: number, ator: Ator, autoria: Autoria, dados: CorpoDaEdicao): Promise<void> => {
    await repositorio.emTransacao(async (repo) => {
        const alvo = await exigirAlcance(repo, empresaId, id, ator);
        await exigirReferencias(repo, dados.cargo_id ?? null, dados.departamento_id ?? null, empresaId);
        const atual = (await repo.cadastroAtual(id, empresaId))!;

        // A admissão e o nascimento se comparam com o que já está gravado quando só um deles veio.
        const nascimento = dados.data_nascimento === undefined ? alvo.data_nascimento : dados.data_nascimento;
        const admissao = dados.data_admissao === undefined ? alvo.data_admissao : dados.data_admissao;
        if (nascimento && admissao && admissao < nascimento) {
            const mensagem = 'Data de admissão não pode ser anterior à data de nascimento.';
            throw new ErroDeFuncionario('invalido', mensagem, { detalhes: [{ campo: 'data_admissao', mensagem }] });
        }

        if (!await repo.atualizarFuncionario({ ...dados, id, empresaId }).catch(traduzirDuplicidade)) {
            throw new ErroDeFuncionario('inexistente', 'Funcionário não encontrado.');
        }

        if (dados.nome !== undefined || dados.email !== undefined) {
            await repo.sincronizarUsuario(id, empresaId, { nome: dados.nome, email: dados.email });
        }

        // O que o cadastro passa a ser: o que já estava, com o que veio por cima.
        const efetivo = { ...atual, ...Object.fromEntries(Object.entries(dados).filter(([, valor]) => valor !== undefined)) } as typeof atual;
        await registrarVigencia(repo, {
            empresaId, funcionarioId: id, salario: efetivo.salario_base, cargoId: efetivo.cargo_id, departamentoId: efetivo.departamento_id,
            inicio: (atual.data_admissao as string | null) ?? hoje(), autoria,
        });

        const mudancas = diferencas(atual, efetivo, COLUNAS_AUDITADAS);
        if (mudancas) {
            // Cargo e departamento aparecem na trilha também pelo nome, que é o que quem lê reconhece.
            const { antes, depois } = mudancas;
            if ('cargo_id' in depois) {
                antes.cargo = atual.cargo_nome;
                depois.cargo = efetivo.cargo_id ? await repo.nomeDoCargo(efetivo.cargo_id, empresaId) : null;
            }
            if ('departamento_id' in depois) {
                antes.departamento = atual.departamento_nome;
                depois.departamento = efetivo.departamento_id ? await repo.nomeDoDepartamento(efetivo.departamento_id, empresaId) : null;
            }
            await repo.auditar(autoria, { acao: 'funcionario.editado', entidade: 'funcionario', entidadeId: id, antes, depois });
        }
        const salario = diferencas({ salario_base: atual.salario_base === null ? null : Number(atual.salario_base) }, { salario_base: efetivo.salario_base === null ? null : Number(efetivo.salario_base) }, ['salario_base']);
        if (salario) {
            await repo.auditar(autoria, { acao: 'funcionario.salario_alterado', entidade: 'funcionario', entidadeId: id, antes: salario.antes, depois: salario.depois });
        }
    });
};

// ==========================================
// DEPENDENTES
// ==========================================

export type DependenteDoColaborador = Omit<DependenteGravado, keyof RowDataPacket>;

const DEPENDENTE_NAO_ENCONTRADO = 'Dependente não encontrado.';

const DEPENDENTE_COM_CPF_REPETIDO = 'Este CPF já está cadastrado como dependente deste colaborador.';

const traduzirDuplicidadeDeDependente = (erro: unknown): never => {
    if ((erro as { code?: string }).code === 'ER_DUP_ENTRY') {
        throw new ErroDeFuncionario('conflito', DEPENDENTE_COM_CPF_REPETIDO, { detalhes: [{ campo: 'cpf', mensagem: DEPENDENTE_COM_CPF_REPETIDO }] });
    }
    throw erro;
};

// Ver os dependentes vale para quem gere colaboradores; alterá-los segue o alcance sobre o cadastro.
export const listarDependentes = async (empresaId: number, funcionarioId: number): Promise<DependenteDoColaborador[]> => {
    return repositorio.emTransacao(async (repo) => {
        if (!await repo.alvoDoCicloDeVida(funcionarioId, empresaId)) throw new ErroDeFuncionario('inexistente', 'Funcionário não encontrado.');
        return repo.listarDependentes(funcionarioId, empresaId);
    });
};

export const criarDependente = async (empresaId: number, funcionarioId: number, ator: Ator, autoria: Autoria, dados: CorpoDoDependente): Promise<number> => {
    return repositorio.emTransacao(async (repo) => {
        await exigirAlcance(repo, empresaId, funcionarioId, ator);
        const id = await repo.inserirDependente(funcionarioId, empresaId, dados).catch(traduzirDuplicidadeDeDependente);
        await repo.auditar(autoria, { acao: 'funcionario.dependente_criado', entidade: 'funcionario', entidadeId: funcionarioId, depois: { nome: dados.nome, parentesco: dados.parentesco } });
        return id;
    });
};

export const atualizarDependente = async (empresaId: number, funcionarioId: number, dependenteId: number, ator: Ator, autoria: Autoria, dados: CorpoDoDependente): Promise<void> => {
    await repositorio.emTransacao(async (repo) => {
        await exigirAlcance(repo, empresaId, funcionarioId, ator);
        if (!await repo.atualizarDependente(dependenteId, funcionarioId, empresaId, dados).catch(traduzirDuplicidadeDeDependente)) {
            throw new ErroDeFuncionario('inexistente', DEPENDENTE_NAO_ENCONTRADO);
        }
        await repo.auditar(autoria, { acao: 'funcionario.dependente_alterado', entidade: 'funcionario', entidadeId: funcionarioId, depois: { nome: dados.nome, parentesco: dados.parentesco } });
    });
};

export const excluirDependente = async (empresaId: number, funcionarioId: number, dependenteId: number, ator: Ator, autoria: Autoria): Promise<void> => {
    await repositorio.emTransacao(async (repo) => {
        await exigirAlcance(repo, empresaId, funcionarioId, ator);
        if (!await repo.excluirDependente(dependenteId, funcionarioId, empresaId)) throw new ErroDeFuncionario('inexistente', DEPENDENTE_NAO_ENCONTRADO);
        await repo.auditar(autoria, { acao: 'funcionario.dependente_excluido', entidade: 'funcionario', entidadeId: funcionarioId });
    });
};

// ==========================================
// IMPORTAÇÃO POR CSV
// ==========================================

export interface RelatorioDaImportacao {
    total: number;
    criados: number;
    // Uma entrada por linha recusada, com o motivo para quem corrige a planilha.
    erros: { linha: number; nome: string | null; motivo: string }[];
    // As senhas provisórias dos colaboradores criados: o banco guarda só o hash, então este
    // relatório é a única chance de entregá-las.
    credenciais: { linha: number; nome: string; email: string; senha_provisoria: string }[];
}

// Uma falha de banco numa linha não derruba o arquivo: vira o motivo daquela linha. O que é
// incidente (5xx) vai ao log e ao Sentry, como em qualquer rota.
const motivoDaFalha = (erro: unknown): string => {
    if (erro instanceof ErroDeFuncionario) return erro.message;
    const traduzido = traduzirErro(erro);
    if (traduzido && traduzido.status < 500) return traduzido.erro;
    logger.error({ err: erro }, 'Erro ao importar uma linha de colaboradores.');
    registrarNoSentry(erro);
    return 'Não foi possível gravar esta linha. Tente importá-la de novo.';
};

// Cada linha vale por si: a inválida é devolvida com o motivo e as demais são criadas, cada uma
// na sua transação. Todas ganham uma senha provisória (a troca é obrigatória no primeiro acesso).
export const importarFuncionarios = async (empresaId: number, autoria: Autoria, conteudo: string): Promise<RelatorioDaImportacao> => {
    const linhas = lerPlanilha(conteudo);
    const referencias = await repositorio.estruturaDaEmpresa(empresaId);
    const relatorio: RelatorioDaImportacao = { total: linhas.length, criados: 0, erros: [], credenciais: [] };

    // Valida tudo antes de gravar: o custo do hash só se paga por linha aceita, e em paralelo.
    const aceitas: { linha: number; dados: Omit<CorpoDoCadastro, 'senha'>; senha: string; hash: Promise<string> }[] = [];
    for (const { linha, campos } of linhas) {
        const { cargo, departamento, ...resto } = campos;
        const nome = resto.nome || null;
        const referencia = resolverReferencias({ cargo, departamento }, referencias);
        if ('erro' in referencia) {
            relatorio.erros.push({ linha, nome, motivo: referencia.erro });
            continue;
        }
        const senha = gerarSenhaProvisoria();
        const resultado = schemaDoCadastro.safeParse({ ...resto, ...referencia, senha });
        if (!resultado.success) {
            relatorio.erros.push({ linha, nome, motivo: [...new Set(resultado.error.issues.map((issue) => issue.message))].join(' ') });
            continue;
        }
        aceitas.push({ linha, dados: resultado.data as Omit<CorpoDoCadastro, 'senha'>, senha, hash: bcrypt.hash(senha, VOLTAS_DO_HASH) });
    }

    for (const { linha, dados, senha, hash } of aceitas) {
        try {
            await gravarCadastro(empresaId, autoria, dados, await hash);
            relatorio.criados += 1;
            relatorio.credenciais.push({ linha, nome: dados.nome, email: dados.email, senha_provisoria: senha });
        } catch (erro) {
            relatorio.erros.push({ linha, nome: dados.nome, motivo: motivoDaFalha(erro) });
        }
    }
    relatorio.erros.sort((a, b) => a.linha - b.linha);
    return relatorio;
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
    exigirNaoAnonimizado(alvo);
    return alvo;
};

export interface SituacaoDoFuncionario {
    status: CorpoDoStatus['status'];
    data_desligamento: string | null;
    motivo_desligamento: string | null;
}

// Inativar é desligar: grava data e motivo, derruba as sessões abertas e bloqueia o login, sem
// apagar nada. Reativar (ou pôr de férias) limpa a data e o motivo. O histórico fica no ponto.
export const alterarStatus = async (empresaId: number, id: number, ator: Ator, autoria: Autoria, corpo: CorpoDoStatus): Promise<SituacaoDoFuncionario> => {
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

        const situacao = {
            status: corpo.status,
            data_desligamento: inativando ? corpo.data_desligamento : null,
            motivo_desligamento: inativando ? corpo.motivo_desligamento : null,
        };
        const acao = inativando ? 'funcionario.desligado' : alvo.status === 'Inativo' ? 'funcionario.reativado' : 'funcionario.situacao_alterada';
        await repo.auditar(autoria, {
            acao,
            entidade: 'funcionario',
            entidadeId: id,
            antes: { status: alvo.status, data_desligamento: alvo.data_desligamento, motivo_desligamento: alvo.motivo_desligamento },
            depois: situacao,
        });
        return situacao;
    });
};

// A senha provisória é devolvida aqui e em nenhum outro lugar: o banco guarda só o hash.
export const redefinirSenha = async (empresaId: number, id: number, ator: Ator, autoria: Autoria): Promise<string> => {
    const senhaProvisoria = gerarSenhaProvisoria();
    const senhaCriptografada = await bcrypt.hash(senhaProvisoria, VOLTAS_DO_HASH);

    await repositorio.emTransacao(async (repo) => {
        const alvo = await alvoPermitido(repo, empresaId, id, ator, 'redefinir a senha');
        if (alvo.usuario_id === null) throw new ErroDeFuncionario('inexistente', 'Este colaborador não tem acesso ao sistema.');
        if (alvo.status === 'Inativo') {
            throw new ErroDeFuncionario('conflito', 'Reative o colaborador antes de redefinir a senha: o acesso dele está desativado.');
        }
        await repo.definirSenhaProvisoria(alvo.usuario_id, senhaCriptografada);
        // Só o fato fica na trilha: nem a senha nem o hash.
        await repo.auditar(autoria, { acao: 'funcionario.senha_redefinida', entidade: 'funcionario', entidadeId: id, depois: { usuario_id: alvo.usuario_id } });
    });
    return senhaProvisoria;
};

// Só o cadastro sem movimento pode ser apagado (o engano de digitação, por exemplo). Quem já
// marcou ponto, justificou um dia ou pediu férias ou afastamento é inativado: a exclusão levaria o histórico junto. Ninguém
// exclui o próprio cadastro: a conta cairia junto.
export const deletarFuncionario = async (empresaId: number, id: number, ator: Ator, autoria: Autoria): Promise<void> => {
    await repositorio.emTransacao(async (repo) => {
        await exigirAlcance(repo, empresaId, id, ator);
        if (ator.funcionarioId === id) throw new ErroDeFuncionario('proibido', 'Você não pode excluir o seu próprio cadastro.');

        if (await repo.temMovimento(id)) {
            throw new ErroDeFuncionario('conflito', 'Este colaborador tem registros de ponto, justificativas ou solicitações e não pode ser excluído. Inative-o para preservar o histórico.');
        }

        const atual = (await repo.cadastroAtual(id, empresaId))!;
        await repo.excluirUsuarios(id, empresaId);
        await repo.excluirFuncionario(id, empresaId);
        await repo.auditar(autoria, {
            acao: 'funcionario.excluido',
            entidade: 'funcionario',
            entidadeId: id,
            antes: { nome: atual.nome, email: atual.email, cargo: atual.cargo_nome, departamento: atual.departamento_nome },
        });
    });
};

// O histórico contratual do cadastro, do período mais recente ao mais antigo.
export const historicoContratual = async (empresaId: number, id: number): Promise<PeriodoContratual[]> => {
    if (!await repositorio.funcionarioDaEmpresa(id, empresaId)) throw new ErroDeFuncionario('inexistente', 'Funcionário não encontrado.');
    return repositorio.historicoDoFuncionario(id, empresaId);
};
