// Regras dos dados legais da empresa, os que o holerite imprime. Não conhece HTTP (falhas de regra
// saem como ErroDeEmpresa) e só chega ao banco pelo repositório.
import * as repositorio from './empresa.repository.ts';
import type { EmpresaGravada } from './empresa.repository.ts';
import { ErroDeEmpresa } from './empresa.erros.ts';
import type { DadosDaEmpresa } from './empresa.schemas.ts';

// Formato que o front-end consome (frontend/src/services/empresaService.ts).
export interface EmpresaDoSistema {
    nome: string;
    razao_social: string | null;
    cnpj: string | null;
    regime_tributario: EmpresaGravada['regime_tributario'];
}

const CNPJ_DUPLICADO = 'Este CNPJ já está cadastrado em outra empresa.';

const empresaDe = ({ nome, razao_social, cnpj, regime_tributario }: EmpresaGravada): EmpresaDoSistema => ({ nome, razao_social, cnpj, regime_tributario });

export const buscarEmpresa = async (empresaId: number): Promise<EmpresaDoSistema> => {
    const empresa = await repositorio.empresaPorId(empresaId);
    if (!empresa) throw new ErroDeEmpresa('inexistente', 'Empresa não encontrada.');
    return empresaDe(empresa);
};

export const atualizarEmpresa = async ({ empresaId, dados }: { empresaId: number; dados: DadosDaEmpresa }): Promise<EmpresaDoSistema> => {
    try {
        await repositorio.atualizarDados(empresaId, dados);
    } catch (erro) {
        if ((erro as { code?: string }).code === 'ER_DUP_ENTRY') throw new ErroDeEmpresa('conflito', CNPJ_DUPLICADO);
        throw erro;
    }
    return buscarEmpresa(empresaId);
};
