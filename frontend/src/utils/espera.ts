// Tempo de espera de um 429 do servidor (retryAfterSegundos) em linguagem de gente.
export const textoDeEspera = (segundos: unknown): string | null => {
  if (typeof segundos !== 'number' || !Number.isFinite(segundos) || segundos <= 0) return null;
  if (segundos < 60) return `${Math.ceil(segundos)} ${Math.ceil(segundos) === 1 ? 'segundo' : 'segundos'}`;
  const minutos = Math.ceil(segundos / 60);
  return `${minutos} ${minutos === 1 ? 'minuto' : 'minutos'}`;
};

// Mensagem de um 429 com quanto falta para tentar de novo; sem o tempo, a do próprio servidor.
export const mensagemDeLimite = (dados: unknown, mensagem: string): string => {
  const espera = textoDeEspera((dados as { retryAfterSegundos?: unknown } | undefined)?.retryAfterSegundos);
  return espera ? `Muitas tentativas. Tente novamente em ${espera}.` : mensagem;
};
