import { z, campo, opcional, texto, email, inteiroPositivo, enumerado, corpoEstrito } from '../../shared/schemas/comum.ts';
import { LIMITES, validarTexto, validarEmail } from '../../shared/schemas/validadores.ts';

// Só RH e Administrador nascem aqui: o Colaborador nasce junto com o cadastro do funcionário.
const PERFIS_NOVOS = ['Administrador', 'RH'] as const;
const PERFIS = ['Administrador', 'RH', 'Colaborador'] as const;

export type Perfil = typeof PERFIS[number];

export const idDaRota = z.object({ id: inteiroPositivo('Identificador') });

export const criarUsuario = corpoEstrito({
    nome: texto('Nome', LIMITES.nome),
    email,
    perfil: enumerado('Perfil', PERFIS_NOVOS),
});

// Na edição o campo ausente fica como está (undefined); se vier, segue a mesma regra do cadastro.
const nomeEditado = campo((valor) => {
    if (valor === undefined) return { valor: undefined };
    const erro = validarTexto(valor, 'Nome', LIMITES.nome);
    return erro ? { erro } : { valor: (valor as string).trim() };
});

const emailEditado = campo((valor) => {
    if (valor === undefined) return { valor: undefined };
    const erro = validarEmail(valor);
    return erro ? { erro } : { valor: (valor as string).trim().toLowerCase() };
});

// Todos os campos são opcionais; pelo menos um precisa vir. `redefinir_senha` gera outra senha provisória.
export const atualizarUsuario = corpoEstrito({
    nome: nomeEditado,
    email: emailEditado,
    perfil: opcional(enumerado('Perfil', PERFIS)).transform((perfil: Perfil | null) => perfil ?? undefined),
    redefinir_senha: z.boolean({ error: 'redefinir_senha deve ser verdadeiro ou falso.' }).optional(),
}).check((ctx) => {
    const { nome, email: novoEmail, perfil, redefinir_senha: redefinirSenha } = ctx.value as CorpoDaEdicao;
    if (nome === undefined && novoEmail === undefined && perfil === undefined && !redefinirSenha) {
        ctx.issues.push({ code: 'custom', message: 'Informe ao menos um campo para alterar.', input: ctx.value });
    }
});

// O que cada schema entrega em req.dadosValidados. Os tipos são escritos à mão: mude-os junto com
// o schema.
export interface IdDaRota {
    id: number;
}

export interface CorpoDoCadastro {
    nome: string;
    email: string;
    perfil: typeof PERFIS_NOVOS[number];
}

export interface CorpoDaEdicao {
    nome?: string;
    email?: string;
    perfil?: Perfil;
    redefinir_senha?: boolean;
}
