// Regras da leitura da trilha de auditoria: o que a empresa vê e em que formato. Não conhece HTTP e só
// chega ao banco pelo repositório.
import * as repositorio from './auditoria.repository.ts';
import type { LinhaDeAuditoria } from './auditoria.repository.ts';
import type { ConsultaDeAuditoria } from './auditoria.schemas.ts';
import { limiteEDeslocamento } from '../../shared/utils/paginacao.ts';

// Formato que o front-end consome (frontend/src/services/auditoriaService.ts).
export interface RegistroDeAuditoria {
    id: number;
    acao: string;
    entidade: string;
    entidade_id: number | null;
    funcionario_id: number | null;
    usuario_id: number | null;
    usuario_nome: string | null;
    perfil: string | null;
    ip: string | null;
    antes: Record<string, unknown> | null;
    depois: Record<string, unknown> | null;
    criado_em: string;
}

export interface PaginaDeAuditoria {
    registros: RegistroDeAuditoria[];
    total: number;
}

const registroDe = ({ criado_em: criadoEm, ...linha }: LinhaDeAuditoria): RegistroDeAuditoria => ({
    ...linha,
    criado_em: new Date(criadoEm).toISOString(),
});

// Só a trilha da empresa de quem pergunta: a empresa vem do token.
export const listarAuditoria = async (empresaId: number, { entidade, id, acao, ...paginacao }: ConsultaDeAuditoria): Promise<PaginaDeAuditoria> => {
    const [limite, deslocamento] = limiteEDeslocamento(paginacao);
    const filtro = { empresaId, entidade, id, acao };
    const linhas = await repositorio.listar(filtro, limite, deslocamento);
    return { registros: linhas.map(registroDe), total: await repositorio.contar(filtro) };
};
