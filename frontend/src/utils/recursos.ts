// Recursos que ainda não têm backend ficam atrás de flag de build, desligada por padrão.
// Só o texto "true" liga: qualquer outro valor, inclusive vazio, mantém o recurso desligado.
export const recursoLigado = (valor: string | undefined): boolean => valor === 'true';

export const solicitacoesAtivas = (): boolean => recursoLigado(import.meta.env.VITE_FEATURE_SOLICITACOES);
