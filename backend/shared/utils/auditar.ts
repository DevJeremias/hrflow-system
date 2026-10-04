// Grava uma linha da trilha de auditoria (tabela auditoria): quem fez, o quê, em qual registro, de
// onde, com o valor anterior e o novo. Roda na conexão que o chamador passar: dentro de uma transação,
// a linha confirma ou desfaz junto com a mudança que ela descreve.
import type { Connection, Pool } from 'mysql2/promise';
import type { Request } from 'express';

// Quem agiu e de onde. Tudo é NULL quando não há conta identificada (um login com e-mail desconhecido).
export interface Autoria {
    empresaId: number | null;
    usuarioId: number | null;
    nome: string | null;
    perfil: string | null;
    ip: string | null;
}

export interface EventoDeAuditoria {
    acao: string;
    entidade: string;
    entidadeId?: number | null;
    // O colaborador a que a ação diz respeito; numa ação sobre um colaborador é o próprio entidadeId.
    funcionarioId?: number | null;
    antes?: unknown;
    depois?: unknown;
}

export type ExecutorDeAuditoria = Pick<Connection | Pool, 'query'>;

// Um IPv6 mapeado de IPv4 (::ffff:10.0.0.1) cabe na coluna e é lido como o IPv4 que ele é.
export const ipDaRequisicao = (req: Request): string | null => req.ip?.replace(/^::ffff:/, '').slice(0, 45) ?? null;

// A autoria de quem fez a requisição: o token (authMiddleware) diz a conta, e req.ip, que respeita
// TRUST_PROXY, diz o endereço.
export const autoriaDe = (req: Request): Autoria => ({
    empresaId: req.usuario?.empresa_id ?? null,
    usuarioId: req.usuario?.id ?? null,
    nome: req.usuario?.nome ?? null,
    perfil: req.usuario?.perfil ?? null,
    ip: ipDaRequisicao(req),
});

// Autoria de quem ainda não tem sessão (login): a conta, se o e-mail a identificou, e o endereço.
export const autoriaDoLogin = (ip: string | null, conta: { empresa_id: number; id: number; nome: string; perfil: string } | null): Autoria => ({
    empresaId: conta?.empresa_id ?? null,
    usuarioId: conta?.id ?? null,
    nome: conta?.nome ?? null,
    perfil: conta?.perfil ?? null,
    ip,
});

const json = (valor: unknown): string | null => (valor === undefined || valor === null ? null : JSON.stringify(valor));

export const gravarAuditoria = async (executor: ExecutorDeAuditoria, autoria: Autoria, evento: EventoDeAuditoria): Promise<void> => {
    const funcionarioId = evento.funcionarioId ?? (evento.entidade === 'funcionario' ? evento.entidadeId ?? null : null);
    await executor.query(
        `INSERT INTO auditoria (empresa_id, usuario_id, usuario_nome, perfil, acao, entidade, entidade_id, funcionario_id, ip, antes, depois)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [autoria.empresaId, autoria.usuarioId, autoria.nome, autoria.perfil, evento.acao, evento.entidade, evento.entidadeId ?? null,
            funcionarioId, autoria.ip, json(evento.antes), json(evento.depois)]
    );
};

type Valor = string | number | boolean | null | undefined;

// Os campos que mudaram, com o valor de antes e o de depois; null quando nada mudou. Números e
// textos de mesmo conteúdo ("5200.00" e 5200) contam como iguais, porque o MySQL devolve DECIMAL como texto.
export const diferencas = <A extends object, D extends object, C extends keyof A & keyof D & string>(
    antes: A, depois: D, campos: readonly C[]
): { antes: Record<string, Valor>; depois: Record<string, Valor> } | null => {
    const de = antes as Record<string, Valor>;
    const para = depois as Record<string, Valor>;
    const igual = (a: Valor, b: Valor) => (a ?? null) === (b ?? null)
        || (a !== null && b !== null && a !== undefined && b !== undefined && typeof a !== typeof b && Number(a) === Number(b) && String(a).trim() !== '');
    const mudou = campos.filter((campo) => !igual(de[campo], para[campo]));
    if (mudou.length === 0) return null;
    return {
        antes: Object.fromEntries(mudou.map((campo) => [campo, de[campo] ?? null])),
        depois: Object.fromEntries(mudou.map((campo) => [campo, para[campo] ?? null])),
    };
};
