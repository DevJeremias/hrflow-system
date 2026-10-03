// Empresas e colaboradores sintéticos para os testes de folha e de dados da empresa.
import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { criarUsuario } from './sessao.ts';

// CNPJ válido (com os dois dígitos verificadores) derivado de um número: dá um CNPJ distinto por
// empresa, porque a coluna é única. Escrito à parte de modules/empresa/empresa.regras.ts de propósito.
export const cnpjDeTeste = (numero: number): string => {
    const base = `${String(numero).padStart(8, '0')}0001`;
    const digito = (digitos: string, pesos: number[]) => {
        const resto = [...digitos].reduce((soma, d, i) => soma + Number(d) * pesos[i], 0) % 11;
        return resto < 2 ? 0 : 11 - resto;
    };
    const primeiro = digito(base, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
    const segundo = digito(base + primeiro, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
    return `${base}${primeiro}${segundo}`;
};

let contador = 0;

// Um CNPJ válido que nenhuma outra empresa de teste usa.
export const novoCnpj = (): string => cnpjDeTeste((process.pid % 10000) * 10000 + (contador += 1));

export interface OpcoesDaEmpresa {
    nome?: string;
    // Razão social e CNPJ preenchidos (padrão). Com false a empresa nasce sem os dados legais.
    comDadosLegais?: boolean;
}

export const criarEmpresa = async (pool: Pool, { nome, comDadosLegais = true }: OpcoesDaEmpresa = {}) => {
    contador += 1;
    const [r] = await pool.query<ResultSetHeader>('INSERT INTO empresas (nome) VALUES (?)', [nome ?? `Empresa Ficticia ${process.pid}-${contador}`]);
    const empresaId = r.insertId;
    const cnpj = novoCnpj();
    if (comDadosLegais) {
        await pool.query('UPDATE empresas SET razao_social = ?, cnpj = ? WHERE id = ?', [`Razao Social Ficticia ${contador} Ltda`, cnpj, empresaId]);
    }
    return { empresaId, cnpj, razaoSocial: `Razao Social Ficticia ${contador} Ltda` };
};

export interface DadosDoFuncionario {
    nome: string;
    salario: number | null;
    contrato?: string | null;
    status?: 'Ativo' | 'Inativo' | 'Férias';
    admissao?: string | null;
}

export const criarFuncionario = async (pool: Pool, empresaId: number, dados: DadosDoFuncionario) => {
    contador += 1;
    // Cargo e departamento vêm do trigger de empresa nova (migration 0002).
    const [[{ cargo }]] = await pool.query<RowDataPacket[]>('SELECT MIN(id) AS cargo FROM cargos WHERE empresa_id = ?', [empresaId]);
    const [[{ departamento }]] = await pool.query<RowDataPacket[]>('SELECT MIN(id) AS departamento FROM departamentos WHERE empresa_id = ?', [empresaId]);
    const [r] = await pool.query<ResultSetHeader>(
        `INSERT INTO funcionarios (nome, email, salario_base, tipo_contrato, status, data_admissao, cargo_id, departamento_id, empresa_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [dados.nome, `pessoa${process.pid}-${contador}@exemplo.invalid`, dados.salario, dados.contrato === undefined ? 'CLT' : dados.contrato,
            dados.status ?? 'Ativo', dados.admissao ?? null, cargo, departamento, empresaId]
    );
    return r.insertId;
};

// Usuário com login para o colaborador.
export const criarColaborador = async (pool: Pool, empresaId: number, dados: DadosDoFuncionario) => {
    const funcionarioId = await criarFuncionario(pool, empresaId, dados);
    return { funcionarioId, ...(await criarUsuario(pool, { empresaId, perfil: 'Colaborador', funcionarioId })) };
};
