// Leitura da planilha de colaboradores (CSV), sem banco: o cabeçalho vira os campos da API, os
// valores no formato brasileiro (dd/mm/aaaa, 3.500,50) viram os da API, e cargo e departamento,
// escritos por nome, viram ids da empresa. Quem grava cada linha é o serviço.
import { lerCsv } from '../../shared/utils/csv.ts';
import type { ReferenciasDaEmpresa } from '../estrutura/index.ts';
import { ErroDeFuncionario } from './funcionarios.erros.ts';

export const MAXIMO_DE_LINHAS = 500;

// Colunas que a planilha aceita: os campos do cadastro, com cargo e departamento por nome.
const COLUNAS = [
    'nome', 'email', 'cpf', 'telefone', 'data_nascimento', 'data_admissao', 'matricula', 'rg', 'pis', 'ctps',
    'cep', 'logradouro', 'numero', 'complemento', 'bairro', 'cidade', 'uf',
    'contato_emergencia_nome', 'contato_emergencia_telefone', 'contato_emergencia_parentesco',
    'banco', 'agencia', 'conta', 'tipo_conta', 'cargo', 'departamento', 'nivel', 'tipo_contrato', 'salario_base',
] as const;
const OBRIGATORIAS = ['nome', 'email'];
const ALIAS: Record<string, string> = { e_mail: 'email' };

export const CABECALHO_DO_MODELO = COLUNAS.join(',');

// Sem acento, em minúsculas e sem espaços sobrando: "Cargo", "cargo " e "CARGO" são a mesma coisa.
const semAcento = (texto: string) => texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

const chaveDaColuna = (rotulo: string) => {
    const chave = semAcento(rotulo).replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    return ALIAS[chave] ?? chave;
};

export interface LinhaDaPlanilha {
    linha: number;
    campos: Record<string, string>;
}

const converterValor = (coluna: string, valor: string): string => {
    const limpo = valor.trim();
    if (coluna.startsWith('data_')) {
        const partes = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(limpo);
        return partes ? `${partes[3]}-${partes[2].padStart(2, '0')}-${partes[1].padStart(2, '0')}` : limpo;
    }
    if (coluna === 'salario_base') {
        const semMoeda = limpo.replace(/^R\$\s*/, '');
        return semMoeda.includes(',') ? semMoeda.replace(/\./g, '').replace(',', '.') : semMoeda;
    }
    return limpo;
};

// Falhas do arquivo inteiro (vazio, sem as colunas obrigatórias, grande demais) recusam tudo com 400;
// o que está errado numa linha só barra aquela linha.
export const lerPlanilha = (conteudo: string): LinhaDaPlanilha[] => {
    const [cabecalho, ...registros] = lerCsv(conteudo);
    if (!cabecalho) throw new ErroDeFuncionario('invalido', 'O arquivo CSV está vazio.');

    const colunas = cabecalho.campos.map(chaveDaColuna);
    const desconhecidas = cabecalho.campos.filter((_, indice) => !(COLUNAS as readonly string[]).includes(colunas[indice]));
    if (desconhecidas.length > 0) {
        throw new ErroDeFuncionario('invalido', `Coluna desconhecida: ${desconhecidas.map((rotulo) => rotulo.trim()).join(', ')}. Colunas aceitas: ${COLUNAS.join(', ')}.`);
    }
    const ausentes = OBRIGATORIAS.filter((obrigatoria) => !colunas.includes(obrigatoria));
    if (ausentes.length > 0) throw new ErroDeFuncionario('invalido', `O cabeçalho precisa das colunas: ${ausentes.join(', ')}.`);
    if (new Set(colunas).size !== colunas.length) throw new ErroDeFuncionario('invalido', 'O cabeçalho tem colunas repetidas.');
    if (registros.length === 0) throw new ErroDeFuncionario('invalido', 'O arquivo CSV não tem nenhuma linha de colaborador.');
    if (registros.length > MAXIMO_DE_LINHAS) {
        throw new ErroDeFuncionario('invalido', `O arquivo tem ${registros.length} linhas: o máximo é ${MAXIMO_DE_LINHAS} por importação. Divida em mais de um arquivo.`);
    }

    return registros.map(({ linha, campos }) => ({
        linha,
        campos: Object.fromEntries(colunas.map((coluna, indice) => [coluna, converterValor(coluna, campos[indice] ?? '')])),
    }));
};

// Cargo e departamento chegam por nome (ou sigla, no departamento). Um nome de cargo que existe em
// mais de um departamento só se resolve com o departamento ao lado.
export const resolverReferencias = (
    { cargo, departamento }: { cargo?: string; departamento?: string },
    { departamentos, cargos }: ReferenciasDaEmpresa,
): { cargo_id: number | null; departamento_id: number | null } | { erro: string } => {
    let departamentoId: number | null = null;
    if (departamento) {
        const alvo = semAcento(departamento);
        const encontrados = departamentos.filter((d) => semAcento(d.nome) === alvo || semAcento(d.sigla) === alvo);
        if (encontrados.length !== 1) return { erro: `Departamento "${departamento}" não encontrado nesta empresa.` };
        departamentoId = encontrados[0].id;
    }
    if (!cargo) return { cargo_id: null, departamento_id: departamentoId };

    const candidatos = cargos.filter((c) => semAcento(c.nome) === semAcento(cargo) && (departamentoId === null || c.departamento_id === departamentoId));
    if (candidatos.length === 0) {
        return { erro: departamentoId === null ? `Cargo "${cargo}" não encontrado nesta empresa.` : `Cargo "${cargo}" não encontrado no departamento "${departamento}".` };
    }
    if (candidatos.length > 1) return { erro: `Cargo "${cargo}" existe em mais de um departamento: informe a coluna departamento.` };
    return { cargo_id: candidatos[0].id, departamento_id: departamentoId ?? candidatos[0].departamento_id };
};
