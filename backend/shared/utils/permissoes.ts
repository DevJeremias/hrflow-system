// A matriz de permissões do sistema: quem pode cada ação. É a única fonte das regras por perfil;
// as rotas pedem a ação por nome (exigirPermissao, em shared/middlewares/roleMiddleware.ts) em vez de
// listar perfis. A mesma matriz está documentada em docs/permissoes.md, e tests/permissoes.test.ts
// confere cada rota contra ela.
export const PERFIS = ['Administrador', 'RH', 'Colaborador'] as const;
export type Perfil = typeof PERFIS[number];

const GESTAO: readonly Perfil[] = ['Administrador', 'RH'];
const SO_ADMINISTRADOR: readonly Perfil[] = ['Administrador'];

export const PERMISSOES = {
    // Contas de acesso (RH e Administrador nascem aqui) e a estrutura da empresa.
    'usuarios:gerir': SO_ADMINISTRADOR,
    'estrutura:gerir': SO_ADMINISTRADOR,
    // Os dados da empresa (razão social, CNPJ) alimentam a folha: o RH consulta, o Administrador altera.
    'empresa:gerir': SO_ADMINISTRADOR,
    'empresa:consultar': GESTAO,
    // O RH precisa dos cargos e departamentos para cadastrar colaboradores.
    'estrutura:consultar': GESTAO,
    // O alcance sobre cada cadastro (RH não toca RH, Administrador nem o próprio) é o de podeGerirCadastro.
    'colaboradores:gerir': GESTAO,
    'folha:processar': GESTAO,
    'ponto:consultar-empresa': GESTAO,
    // A fila de férias e afastamentos da empresa e a decisão sobre cada pedido (o alcance sobre cada pedido está em ausencias.service.ts).
    'ausencias:gerir': GESTAO,
    'dashboard:consultar': GESTAO,
} as const satisfies Record<string, readonly Perfil[]>;

export type Permissao = keyof typeof PERMISSOES;

export const perfilTem = (perfil: string, permissao: Permissao): boolean =>
    (PERMISSOES[permissao] as readonly string[]).includes(perfil);

export interface AtorDoCadastro {
    perfil: string;
    funcionario_id: number | null;
}

export interface AlvoDoCadastro {
    id: number;
    // Perfil da conta de acesso ligada ao cadastro; null quando não há conta.
    perfilDaConta: string | null;
}

// Por que o ator não pode alterar nem excluir o cadastro do alvo, ou null se pode. O Administrador
// alcança qualquer cadastro; o RH, só o dos colaboradores que não são ele mesmo.
export const motivoDeNegacaoDoCadastro = (ator: AtorDoCadastro, alvo: AlvoDoCadastro): string | null => {
    if (ator.perfil === 'Administrador') return null;
    if (ator.funcionario_id !== null && ator.funcionario_id === alvo.id) {
        return 'Você não pode alterar o seu próprio cadastro. Peça a um Administrador.';
    }
    if (alvo.perfilDaConta === 'RH' || alvo.perfilDaConta === 'Administrador') {
        return 'Só um Administrador altera o cadastro de quem tem acesso de RH ou Administrador.';
    }
    return null;
};
