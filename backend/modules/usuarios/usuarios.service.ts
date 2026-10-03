// Regras das contas de acesso: só o Administrador cria RH e Administradores, e nenhuma conta nasce
// com senha que o Administrador escolheu: a senha é provisória, gerada aqui, devolvida uma única
// vez e trocada pelo titular no primeiro acesso. Não conhece HTTP (falhas de regra saem como
// ErroDeUsuario) e só chega ao banco pelo repositório.
import bcrypt from 'bcrypt';
import * as repositorio from './usuarios.repository.ts';
import type { UsuarioListado } from './usuarios.repository.ts';
import { ErroDeUsuario } from './usuarios.erros.ts';
import type { CorpoDaEdicao, CorpoDoCadastro } from './usuarios.schemas.ts';
import { diferencas } from '../../shared/utils/auditar.ts';
import type { Autoria } from '../../shared/utils/auditar.ts';
import { EMAIL_DUPLICADO } from '../../shared/utils/erros.ts';
import { limiteEDeslocamento } from '../../shared/utils/paginacao.ts';
import { gerarSenhaProvisoria } from '../../shared/utils/senhaProvisoria.ts';

const VOLTAS_DO_HASH = 10;

const emailDuplicado = () => new ErroDeUsuario('conflito', EMAIL_DUPLICADO, { detalhes: [{ campo: 'email', mensagem: EMAIL_DUPLICADO }] });

export interface PaginaDeUsuarios {
    usuarios: UsuarioListado[];
    total: number;
}

export interface UsuarioCriado {
    usuario: UsuarioListado;
    // Aparece só nesta resposta; o banco guarda apenas o hash.
    senha_provisoria: string;
}

export interface UsuarioAlterado {
    usuario: UsuarioListado;
    // Só existe quando a edição pediu `redefinir_senha`.
    senha_provisoria?: string;
}

export const listarUsuarios = async (empresaId: number, paginacao: { pagina: number; limite: number }): Promise<PaginaDeUsuarios> => {
    const [limite, deslocamento] = limiteEDeslocamento(paginacao);
    const usuarios = await repositorio.listarDaEmpresa(empresaId, limite, deslocamento);
    const total = await repositorio.contarDaEmpresa(empresaId);
    return { usuarios, total };
};

export const criarUsuario = async (empresaId: number, autoria: Autoria, dados: CorpoDoCadastro): Promise<UsuarioCriado> => {
    const senhaProvisoria = gerarSenhaProvisoria();
    const senhaCriptografada = await bcrypt.hash(senhaProvisoria, VOLTAS_DO_HASH);

    const usuario = await repositorio.emTransacao(async (repo) => {
        if (await repo.emailEmUso(dados.email)) throw emailDuplicado();
        const id = await repo.inserir({ ...dados, senhaCriptografada, empresaId });
        await repo.auditar(autoria, { acao: 'usuario.criado', entidade: 'usuario', entidadeId: id, depois: { nome: dados.nome, email: dados.email, perfil: dados.perfil } });
        return (await repo.buscarDaEmpresa(id, empresaId))!;
    });
    return { usuario, senha_provisoria: senhaProvisoria };
};

interface Operador {
    id: number;
    empresa_id: number;
}

export const atualizarUsuario = async (operador: Operador, autoria: Autoria, id: number, dados: CorpoDaEdicao): Promise<UsuarioAlterado> => {
    const empresaId = operador.empresa_id;
    const propria = operador.id === id;
    const senhaProvisoria = dados.redefinir_senha ? gerarSenhaProvisoria() : undefined;
    const senhaCriptografada = senhaProvisoria ? await bcrypt.hash(senhaProvisoria, VOLTAS_DO_HASH) : undefined;

    const usuario = await repositorio.emTransacao(async (repo) => {
        const atual = await repo.buscarDaEmpresa(id, empresaId, true);
        if (!atual) throw new ErroDeUsuario('inexistente', 'Usuário não encontrado.');

        // Quem tem cadastro de funcionário muda nome e e-mail por lá: o cadastro e a conta andam juntos.
        const vinculado = atual.funcionario_id !== null;
        if (vinculado && (dados.nome !== undefined || dados.email !== undefined)) {
            throw new ErroDeUsuario('invalido', 'Esta conta é de um colaborador: altere o nome e o e-mail no cadastro dele.');
        }
        if (dados.email !== undefined && dados.email !== atual.email && await repo.emailEmUso(dados.email, id)) throw emailDuplicado();

        if (dados.perfil !== undefined && dados.perfil !== atual.perfil) {
            if (propria) throw new ErroDeUsuario('proibido', 'Você não pode alterar o seu próprio perfil: peça a outro Administrador.');
            // Sem cadastro de funcionário a conta não tem o que fazer como Colaborador (ponto, holerite).
            if (!vinculado && dados.perfil === 'Colaborador') {
                throw new ErroDeUsuario('invalido', 'Só uma conta com cadastro de colaborador pode ter o perfil Colaborador.');
            }
        }
        if (propria && dados.redefinir_senha) {
            throw new ErroDeUsuario('proibido', 'Troque a sua senha pelo seu perfil.');
        }

        await repo.atualizar({ id, empresaId, nome: dados.nome, email: dados.email, perfil: dados.perfil });
        if (senhaCriptografada) await repo.definirSenhaProvisoria(id, empresaId, senhaCriptografada);
        const depois = (await repo.buscarDaEmpresa(id, empresaId))!;

        const mudancas = diferencas(atual, depois, ['nome', 'email', 'perfil']);
        const alvo = { entidade: 'usuario', entidadeId: id, funcionarioId: atual.funcionario_id };
        if (mudancas) await repo.auditar(autoria, { acao: 'usuario.editado', ...alvo, ...mudancas });
        // Só o fato fica na trilha: nem a senha nem o hash.
        if (senhaCriptografada) await repo.auditar(autoria, { acao: 'usuario.senha_redefinida', ...alvo });
        return depois;
    });
    return { usuario, ...(senhaProvisoria && { senha_provisoria: senhaProvisoria }) };
};
