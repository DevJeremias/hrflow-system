// Regras do perfil: o que cada pessoa vê de si mesma, a troca dos próprios dados e da senha. Telefone e
// foto o colaborador grava; nome, e-mail, endereço e dados bancários viram uma solicitação que o RH
// aprova (modules/solicitacoes), a não ser para o Administrador, que não tem a quem pedir. Não conhece
// HTTP (falhas de regra saem como ErroDePerfil) e só chega ao banco pelo repositório.
import bcrypt from 'bcrypt';
import * as repositorio from './perfil.repository.ts';
import type { DadosDoCadastro, MudancaDeAvatar, PerfilDoUsuario } from './perfil.repository.ts';
import { ErroDePerfil } from './perfil.erros.ts';
import { gerarMiniatura, imagemDoDataUrl } from './perfil.miniatura.ts';
import type { CorpoDeAlterarSenha, CorpoDeAtualizarMeusDados } from './perfil.schemas.ts';
import { CAMPOS_DO_CADASTRO, camposAlterados, criarSolicitacao, exigirSenhaAtual } from '../solicitacoes/index.ts';
import type { Autoria } from '../../shared/utils/auditar.ts';
import { EMAIL_DUPLICADO } from '../../shared/utils/erros.ts';

// Sem funcionário vinculado não há cargo nem departamento reais: o Administrador de conta
// recém-criada e um usuário ainda sem vínculo recebem um rótulo no lugar.
const ROTULOS_SEM_VINCULO: Record<string, { cargo: string; departamento: string }> = {
    Administrador: { cargo: 'Gestão do Sistema', departamento: 'Administração' },
    RH: { cargo: 'Vínculo Pendente', departamento: 'Não atrelado' },
    Colaborador: { cargo: 'Vínculo Pendente', departamento: 'Não atrelado' },
};

const CUSTO_DO_HASH = 10;

// Quem faz a requisição, como o token o descreve.
export interface Operador {
    id: number;
    empresa_id: number;
    perfil: string;
    funcionario_id: number | null;
}

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
    // O encarregado pelo tratamento de dados que a empresa indicou; null enquanto ela não indicar.
    encarregado: { nome: string; email: string } | null;
}

// Uma única resposta para todos os perfis: o que depende do vínculo com o funcionário vem null
// quando ele não existe, e `vinculado` diz ao cliente se há contrato e dados bancários a mostrar.
export const obterMeuPerfil = async (usuarioId: number, empresaId: number): Promise<MeuPerfil> => {
    const linha = await repositorio.perfilDoUsuario(usuarioId, empresaId);
    if (!linha) throw new ErroDePerfil('inexistente', 'Perfil não encontrado.');

    const { funcionario_id: funcionarioId, encarregado_nome: nome, encarregado_email: email, ...perfil } = linha;
    const vinculado = funcionarioId !== null;
    return {
        ...perfil,
        ...(vinculado ? {} : ROTULOS_SEM_VINCULO[perfil.perfil]),
        vinculado,
        encarregado: nome && email ? { nome, email } : null,
    };
};

interface DadosDeAtualizacao {
    operador: Operador;
    autoria: Autoria;
    corpo: CorpoDeAtualizarMeusDados;
}

export interface ResultadoDaAtualizacao {
    // Trocar o e-mail de login revoga as sessões abertas, a desta requisição inclusive.
    sessaoEncerrada: boolean;
}

const NOMES_DOS_CAMPOS: Record<string, string> = {
    nome: 'nome', email: 'e-mail', endereco: 'endereço', banco: 'banco', agencia: 'agência', conta: 'conta', tipo_conta: 'tipo de conta',
};

const SO_CADASTRO = 'Só quem tem cadastro de colaborador pode alterar endereço ou dados bancários.';

// A imagem é decodificada antes da transação: gerar a miniatura é trabalho de CPU e não deve segurar uma conexão.
const prepararAvatar = async (avatar: string): Promise<NonNullable<MudancaDeAvatar>> => {
    const { tipo, bytes } = imagemDoDataUrl(avatar);
    return { tipo, original: bytes, miniatura: await gerarMiniatura(bytes) };
};

const valorDoAvatar = (avatar: MudancaDeAvatar): string | undefined => (avatar === undefined ? undefined : avatar === null ? 'removido' : 'alterado');

export const atualizarMeusDados = async ({ operador, autoria, corpo }: DadosDeAtualizacao): Promise<ResultadoDaAtualizacao> => {
    const { telefone, avatar, senhaAtual, ...campos } = corpo;

    // Quem tem a quem pedir não grava os dados protegidos: o pedido é criado e a resposta é 403, sem gravar
    // mais nada (nem telefone nem foto, que seguem na mesma requisição).
    if (operador.perfil !== 'Administrador') {
        const atual = await repositorio.perfilDoUsuario(operador.id, operador.empresa_id);
        if (!atual) throw new ErroDePerfil('inexistente', 'Perfil não encontrado.');
        const { alteracoes } = camposAlterados(atual, campos);
        if (Object.keys(alteracoes).length > 0) {
            const solicitacao = await criarSolicitacao(operador, autoria, { ...campos, senhaAtual });
            const nomes = Object.keys(alteracoes).map((campo) => NOMES_DOS_CAMPOS[campo]).join(', ');
            throw new ErroDePerfil('proibido', `A alteração de ${nomes} depende de aprovação. A solicitação foi enviada ao RH; nada foi alterado.`, { solicitacao });
        }
    }

    const mudancaDeAvatar = typeof avatar === 'string' ? await prepararAvatar(avatar) : avatar;

    return repositorio.emTransacao(async (repo) => {
        const atual = await repo.perfilDoUsuario(operador.id, operador.empresa_id, true);
        if (!atual) throw new ErroDePerfil('inexistente', 'Perfil não encontrado.');

        const { alteracoes } = camposAlterados(atual, campos);
        if (atual.funcionario_id === null && CAMPOS_DO_CADASTRO.some((campo) => campo in alteracoes)) throw new ErroDePerfil('invalido', SO_CADASTRO);
        const emailMudou = 'email' in alteracoes;
        if (emailMudou) {
            const hash = (await repo.hashDaSenha(operador.id))!;
            await exigirSenhaAtual(hash, senhaAtual);
            if (await repo.emailEmUsoPorOutro(alteracoes.email as string, operador.id)) {
                throw new ErroDePerfil('invalido', 'E-mail já utilizado por outra conta.', { detalhes: [{ campo: 'email', mensagem: EMAIL_DUPLICADO }] });
            }
        }

        // O telefone só existe no cadastro de colaborador.
        const telefoneMudou = telefone !== undefined && atual.funcionario_id !== null && telefone !== atual.telefone;
        // nome e e-mail nunca são null: o schema os recusa vazios.
        const gravar: DadosDoCadastro = { ...(alteracoes as DadosDoCadastro), ...(telefoneMudou && { telefone }) };

        if (Object.keys(alteracoes).some((campo) => campo === 'nome' || campo === 'email')) {
            await repo.atualizarConta(operador.id, operador.empresa_id, { nome: gravar.nome, email: gravar.email });
        }
        if (atual.funcionario_id !== null && Object.keys(gravar).length > 0) {
            await repo.atualizarCadastro(atual.funcionario_id, operador.empresa_id, gravar);
        }
        if (mudancaDeAvatar === null) await repo.removerAvatar(operador.id);
        else if (mudancaDeAvatar) await repo.gravarAvatar(operador.id, mudancaDeAvatar);

        const chaves = Object.keys(gravar) as (keyof PerfilDoUsuario)[];
        const imagem = valorDoAvatar(mudancaDeAvatar);
        if (chaves.length > 0 || imagem) {
            await repo.auditar(autoria, {
                acao: 'perfil.atualizado',
                entidade: 'usuario',
                entidadeId: operador.id,
                funcionarioId: atual.funcionario_id,
                antes: Object.fromEntries(chaves.map((campo) => [campo, atual[campo] ?? null])),
                // A imagem não entra na trilha: só o fato de ter mudado.
                depois: { ...gravar, ...(imagem && { avatar: imagem }) },
            });
        }
        return { sessaoEncerrada: emailMudou };
    });
};

export const alterarMinhaSenha = async (operador: Operador, autoria: Autoria, { senhaAtual, novaSenha }: CorpoDeAlterarSenha): Promise<void> => {
    const hash = await repositorio.hashDaSenha(operador.id);
    if (hash === undefined) throw new ErroDePerfil('inexistente', 'Usuário não encontrado.');

    if (!await bcrypt.compare(senhaAtual, hash)) throw new ErroDePerfil('invalido', 'A senha atual está incorreta.');
    if (await bcrypt.compare(novaSenha, hash)) throw new ErroDePerfil('invalido', 'A nova senha deve ser diferente da atual.');

    const novoHash = await bcrypt.hash(novaSenha, CUSTO_DO_HASH);
    await repositorio.emTransacao(async (repo) => {
        await repo.trocarSenha(operador.id, novoHash);
        await repo.auditar(autoria, { acao: 'senha.alterada', entidade: 'usuario', entidadeId: operador.id, funcionarioId: operador.funcionario_id });
    });
};

// A miniatura do avatar. Quem enviou a foto antes de a miniatura existir tem só o original: ela é
// gerada na primeira leitura e guardada.
export const obterMeuAvatar = async (usuarioId: number, empresaId: number): Promise<Buffer> => {
    const avatar = await repositorio.avatarDoUsuario(usuarioId, empresaId);
    if (!avatar) throw new ErroDePerfil('inexistente', 'Você ainda não tem avatar.');
    if (avatar.miniatura) return avatar.miniatura;

    const original = await repositorio.avatarOriginal(usuarioId);
    if (!original) throw new ErroDePerfil('inexistente', 'Você ainda não tem avatar.');
    const miniatura = await gerarMiniatura(original).catch(() => {
        throw new ErroDePerfil('inexistente', 'O avatar gravado não pôde ser lido. Envie outra foto.');
    });
    await repositorio.gravarMiniatura(usuarioId, miniatura);
    return miniatura;
};
