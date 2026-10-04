// Os direitos do titular (LGPD) sobre o cadastro de um colaborador: exportar tudo o que o sistema
// guarda dele (portabilidade e acesso) e anonimizar o cadastro de quem já saiu (eliminação). A política
// de retenção que explica o que fica e o que sai está em docs/lgpd.md. Não conhece HTTP (falhas de
// regra saem como ErroDeFuncionario) e só chega ao banco pelo repositório.
import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import * as repositorio from './funcionarios.titular.repository.ts';
import { ErroDeFuncionario } from './funcionarios.erros.ts';
import type { Autoria } from '../../shared/utils/auditar.ts';

const VOLTAS_DO_HASH = 10;

export interface ExportacaoDoTitular {
    exportado_em: string;
    titular: Record<string, unknown>;
    contas_de_acesso: unknown[];
    dependentes: unknown[];
    tem_avatar: boolean;
    historico_contratual: unknown[];
    ponto: { marcacoes: unknown[]; justificativas: unknown[] };
    ferias_e_afastamentos: unknown[];
    holerites: unknown[];
    solicitacoes_de_alteracao: unknown[];
    trilha_de_auditoria: unknown[];
}

// Tudo o que o sistema guarda do colaborador, em JSON. A senha (nem o hash) e a imagem do avatar não vão.
// A exportação é registrada na trilha: quem tirou os dados de quem.
export const exportarDados = async (empresaId: number, id: number, autoria: Autoria): Promise<ExportacaoDoTitular> => {
    const titular = await repositorio.cadastroDoTitular(id, empresaId);
    if (!titular) throw new ErroDeFuncionario('inexistente', 'Funcionário não encontrado.');

    const [contas, dependentes, temAvatar, historico, marcacoes, justificativas, ausencias, holerites, solicitacoes, trilha] = await Promise.all([
        repositorio.contas(id, empresaId),
        repositorio.dependentes(id, empresaId),
        repositorio.temAvatar(id, empresaId),
        repositorio.historicoContratual(id, empresaId),
        repositorio.marcacoes(id, empresaId),
        repositorio.justificativas(id, empresaId),
        repositorio.ausencias(id, empresaId),
        repositorio.holerites(id, empresaId),
        repositorio.solicitacoes(id, empresaId),
        repositorio.trilha(id, empresaId),
    ]);

    await repositorio.emTransacao((repo) => repo.auditar(autoria, { acao: 'funcionario.exportado', entidade: 'funcionario', entidadeId: id }));

    return {
        exportado_em: new Date().toISOString(),
        titular,
        contas_de_acesso: contas,
        dependentes,
        tem_avatar: temAvatar,
        historico_contratual: historico,
        ponto: { marcacoes, justificativas },
        ferias_e_afastamentos: ausencias,
        holerites,
        solicitacoes_de_alteracao: solicitacoes,
        trilha_de_auditoria: trilha,
    };
};

export const nomeAnonimo = (id: number): string => `Colaborador anonimizado ${id}`;
export const emailAnonimo = (id: number): string => `anonimizado-${id}@anonimizado.invalid`;

// Apaga o que identifica o colaborador (CPF, RG, PIS, CTPS, nome, e-mail, telefone, endereço, contato de emergência, dependentes, dados bancários, foto,
// localização das marcações, o texto livre das justificativas e o motivo e o atestado dos pedidos de férias e afastamento) e mantém o que a lei manda guardar:
// o cadastro com o id, as marcações, as decisões, os valores da folha e a trilha (sem o conteúdo pessoal).
// Só vale para quem já foi desligado, nunca para a própria conta de quem pede, e não tem volta.
export const anonimizar = async (empresaId: number, id: number, funcionarioIdDoOperador: number | null, autoria: Autoria): Promise<void> => {
    // O hash é de um valor que ninguém conhece: a conta anonimizada não abre mais.
    const senhaCriptografada = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), VOLTAS_DO_HASH);

    await repositorio.emTransacao(async (repo, cadastro) => {
        const alvo = await cadastro.alvoDoCicloDeVida(id, empresaId);
        if (!alvo) throw new ErroDeFuncionario('inexistente', 'Funcionário não encontrado.');
        if (funcionarioIdDoOperador === id) throw new ErroDeFuncionario('proibido', 'Você não pode anonimizar o seu próprio cadastro.');
        if (alvo.anonimizado_em) throw new ErroDeFuncionario('conflito', 'Este cadastro já foi anonimizado.');
        if (alvo.status !== 'Inativo') {
            throw new ErroDeFuncionario('conflito', 'Só o cadastro de quem já foi desligado pode ser anonimizado. Desligue o colaborador antes.');
        }

        const nome = nomeAnonimo(id);
        const email = emailAnonimo(id);
        await repo.anonimizarCadastro(id, empresaId, nome, email);
        await repo.apagarDependentes(id, empresaId);
        const contas = await repo.anonimizarContas(id, empresaId, nome, email, senhaCriptografada);
        await repo.apagarAvatares(contas);
        await repo.anonimizarHolerites(id, empresaId, nome);
        await repo.anonimizarMarcacoes(id, empresaId);
        await repo.anonimizarJustificativas(id, empresaId);
        await repo.anonimizarAusencias(id, empresaId);
        await repo.anonimizarSolicitacoes(id, empresaId);
        await repo.anonimizarTrilha(id, empresaId, contas, nome);
        // A anonimização é registrada depois de a trilha ser limpa, e sem o que foi apagado.
        await repo.auditar(autoria, { acao: 'funcionario.anonimizado', entidade: 'funcionario', entidadeId: id });
    });
};
