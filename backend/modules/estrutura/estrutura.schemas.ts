import { z, opcional, texto, textoLivre, inteiroPositivo, dinheiro, corpo } from '../../shared/schemas/comum.js';

export const idDaRota = z.object({ id: inteiroPositivo('Identificador') });

export const departamento = corpo({
    nome: texto('Nome do departamento', 100),
    sigla: texto('Sigla', 10),
    descricao: opcional(textoLivre('Descrição', 1000)),
    gestor: opcional(texto('Gestor', 100)),
});

export const cargo = corpo({
    nome: texto('Nome do cargo', 100),
    departamento_id: inteiroPositivo('Departamento'),
    nivel: opcional(texto('Nível', 50)),
    salario_base: opcional(dinheiro('Salário base')).transform((salario) => salario ?? 0),
});

// O que cada schema entrega em req.dadosValidados. schemas/comum.js ainda é JavaScript e seus
// construtores não declaram o tipo que devolvem, então estes tipos são escritos à mão: mude-os
// junto com o schema.
export interface IdDaRota {
    id: number;
}

export interface DadosDoDepartamento {
    nome: string;
    sigla: string;
    descricao: string | null;
    gestor: string | null;
}

export interface DadosDoCargo {
    nome: string;
    departamento_id: number;
    nivel: string | null;
    salario_base: number;
}
