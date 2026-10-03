// Regras do perfil: o que cada pessoa vê de si mesma, a troca dos próprios dados e da senha. Não
// conhece HTTP (falhas de regra saem como ErroDePerfil) e só chega ao banco pelo repositório.
import bcrypt from 'bcrypt';
import * as repositorio from './perfil.repository.ts';
import { ErroDePerfil } from './perfil.erros.ts';
import type { CorpoDeAlterarSenha, CorpoDeAtualizarMeusDados } from './perfil.schemas.ts';

// Sem funcionário vinculado não há cargo nem departamento reais: o Administrador de conta
// recém-criada e um usuário ainda sem vínculo recebem um rótulo no lugar.
const ROTULOS_SEM_VINCULO: Record<string, { cargo: string; departamento: string }> = {
    Administrador: { cargo: 'Gestão do Sistema', departamento: 'Administração' },
    RH: { cargo: 'Vínculo Pendente', departamento: 'Não atrelado' },
    Colaborador: { cargo: 'Vínculo Pendente', departamento: 'Não atrelado' },
};

const CUSTO_DO_HASH = 10;

// O formato que o front-end consome em /api/perfil/meus-dados.
export interface MeuPerfil {
    perfil: string;
    nome: string;
    email: string;
    avatar: string | null;
    telefone: string | null;
    cpf: string | null;
    data_nascimento: string | null;
    data_admissao: string | null;
    endereco: string | null;
    tipo_contrato: string | null;
    nivel: string | null;
    banco: string | null;
    agencia: string | null;
    conta: string | null;
    tipo_conta: string | null;
    cargo: string | null;
    departamento: string | null;
    vinculado: boolean;
}

// Uma única resposta para todos os perfis: o que depende do vínculo com o funcionário vem null
// quando ele não existe, e `vinculado` diz ao cliente se há contrato e dados bancários a mostrar.
export const obterMeuPerfil = async (usuarioId: number, empresaId: number): Promise<MeuPerfil> => {
    const linha = await repositorio.perfilDoUsuario(usuarioId, empresaId);
    if (!linha) throw new ErroDePerfil('inexistente', 'Perfil não encontrado.');

    const { funcionario_id: funcionarioId, ...perfil } = linha;
    const vinculado = funcionarioId !== null;
    return {
        ...perfil,
        ...(vinculado ? {} : ROTULOS_SEM_VINCULO[perfil.perfil]),
        vinculado,
    };
};

interface DadosDeAtualizacao {
    usuarioId: number;
    funcionarioId: number | null;
    empresaId: number;
    corpo: CorpoDeAtualizarMeusDados;
}

export const atualizarMeusDados = async ({ usuarioId, funcionarioId, empresaId, corpo }: DadosDeAtualizacao): Promise<void> => {
    const { nome, email, telefone, avatar } = corpo;

    await repositorio.emTransacao(async (repo) => {
        if (await repo.emailEmUsoPorOutro(email, usuarioId)) {
            throw new ErroDePerfil('invalido', 'E-mail já utilizado por outra conta.');
        }

        // A conta de acesso vale para qualquer perfil; o cadastro de RH só existe para quem tem funcionário.
        await repo.atualizarUsuario({ usuarioId, empresaId, nome, email, avatar });
        if (funcionarioId) {
            await repo.atualizarFuncionario({ funcionarioId, empresaId, nome, email, telefone, avatar });
        }
    });
};

export const alterarMinhaSenha = async (usuarioId: number, { senhaAtual, novaSenha }: CorpoDeAlterarSenha): Promise<void> => {
    const hash = await repositorio.hashDaSenha(usuarioId);
    if (hash === undefined) throw new ErroDePerfil('inexistente', 'Usuário não encontrado.');

    if (!await bcrypt.compare(senhaAtual, hash)) throw new ErroDePerfil('invalido', 'A senha atual está incorreta.');
    if (await bcrypt.compare(novaSenha, hash)) throw new ErroDePerfil('invalido', 'A nova senha deve ser diferente da atual.');

    await repositorio.trocarSenha(usuarioId, await bcrypt.hash(novaSenha, CUSTO_DO_HASH));
};
