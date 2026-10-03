// Regras da autenticação: quem pode abrir conta, quem pode entrar e o que a sessão mostra. Não
// conhece HTTP (falhas de regra saem como ErroDeAuth) e só chega ao banco pelo repositório.
import bcrypt from 'bcrypt';
import { ErroDeAuth } from './auth.erros.ts';
import * as repositorio from './auth.repository.ts';
import type { IdentidadeDaSessao } from './auth.repository.ts';
import type { DadosDeLogin, DadosDeRegistro } from './auth.schemas.ts';
import { emitirToken } from './auth.sessao.ts';

const CUSTO_DO_HASH = 10;

const EMAIL_JA_CADASTRADO = 'E-mail já cadastrado.';

export interface LoginFeito {
    // Só viaja em cookie HttpOnly: não entra no corpo da resposta nem chega ao JavaScript.
    token: string;
    perfil: string;
    nome: string;
}

// Cria a empresa e o usuário administrador ao mesmo tempo.
export const registrarConta = async ({ nomeEmpresa, nomeAdmin, email, senha }: DadosDeRegistro): Promise<void> => {
    // Evita o custo do hash quando o e-mail já existe. A corrida entre dois cadastros
    // iguais é resolvida pela chave única de usuarios.email, dentro da transação.
    if (await repositorio.emailJaCadastrado(email)) throw new ErroDeAuth('conflito', EMAIL_JA_CADASTRADO);

    const senhaCripto = await bcrypt.hash(senha, CUSTO_DO_HASH);
    try {
        await repositorio.criarEmpresaComAdministrador({ nomeEmpresa, nomeAdmin, email, senhaCripto });
    } catch (erro) {
        if ((erro as { code?: string }).code === 'ER_DUP_ENTRY') throw new ErroDeAuth('conflito', EMAIL_JA_CADASTRADO);
        throw erro;
    }
};

// O token carrega a identidade completa e a versão da sessão (ver auth.sessao.ts), com o nome real
// do colaborador: o administrador tem o nome em usuarios, o colaborador na tabela funcionarios.
export const login = async ({ email, senha }: DadosDeLogin): Promise<LoginFeito> => {
    const usuario = await repositorio.usuarioPorEmail(email);
    if (!usuario) throw new ErroDeAuth('naoAutenticado', 'E-mail ou senha inválidos.');

    if (!await bcrypt.compare(senha, usuario.senha)) throw new ErroDeAuth('naoAutenticado', 'E-mail ou senha inválidos.');

    let nome = usuario.nome;
    if (usuario.funcionario_id) {
        const funcionario = await repositorio.funcionarioDoUsuario(usuario.funcionario_id, usuario.empresa_id);
        if (funcionario) {
            // Só depois da senha correta, para a resposta não revelar o estado de contas alheias.
            if (funcionario.status === 'Inativo') {
                throw new ErroDeAuth('proibido', 'Acesso desativado. Procure o RH da sua empresa.');
            }
            nome = funcionario.nome;
        }
    }

    return { token: emitirToken(usuario, nome), perfil: usuario.perfil, nome };
};

// Quem sou eu: a fonte única da identidade que o front-end exibe e usa para guardar rotas.
// Lê do banco, não do token: nome e vínculo refletem o estado atual, e um usuário removido
// deixa de ter sessão (401) em vez de seguir com um token ainda assinado.
export const identidadeDaSessao = async (usuarioId: number): Promise<IdentidadeDaSessao> => {
    const identidade = await repositorio.identidadeDaSessao(usuarioId);
    if (!identidade) throw new ErroDeAuth('naoAutenticado', 'Sessão encerrada. Faça login novamente.');
    return identidade;
};
