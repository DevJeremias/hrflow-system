// Regras dos dados legais da empresa, os que o holerite imprime. Não conhece HTTP (falhas de regra
// saem como ErroDeEmpresa) e só chega ao banco pelo repositório.
import * as repositorio from './empresa.repository.ts';
import type { EmpresaGravada } from './empresa.repository.ts';
import { criarFuso } from '../../shared/utils/fuso.ts';
import type { Fuso } from '../../shared/utils/fuso.ts';
import { ErroDeEmpresa } from './empresa.erros.ts';
import type { DadosDaEmpresa } from './empresa.schemas.ts';

// Formato que o front-end consome (frontend/src/services/empresaService.ts).
export interface EmpresaDoSistema {
    nome: string;
    razao_social: string | null;
    cnpj: string | null;
    regime_tributario: EmpresaGravada['regime_tributario'];
    fuso: string;
}

const CNPJ_DUPLICADO = 'Este CNPJ já está cadastrado em outra empresa.';

const empresaDe = ({ nome, razao_social, cnpj, regime_tributario, fuso }: EmpresaGravada): EmpresaDoSistema => ({ nome, razao_social, cnpj, regime_tributario, fuso });

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

// O fuso da empresa, para quem precisa do "dia" e do "mês" dela (ponto, folha, relatórios). A empresa vem
// do token, então não existir é falha inesperada.
export const fusoDaEmpresa = async (empresaId: number): Promise<Fuso> => {
    const zona = await repositorio.fusoDaEmpresa(empresaId);
    if (zona === undefined) throw new Error(`Empresa ${empresaId} do token não existe.`);
    return criarFuso(zona);
};
