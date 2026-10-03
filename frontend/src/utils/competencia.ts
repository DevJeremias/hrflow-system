// Competência exibida no holerite: o mês corrente por extenso em pt-BR ("outubro de 2026").
// Fica em minúsculas de propósito: o "de" não pode virar "De" por CSS.
export const competenciaAtual = (agora: Date = new Date()): string =>
  new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(agora);
