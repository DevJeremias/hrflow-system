// "1 não lida" / "3 não lidas": o nome do botão do sino diz o que o número do selo mostra.
export const rotuloDoSino = (naoLidas: number): string => {
  if (naoLidas === 0) return 'Notificações';
  return `Notificações: ${naoLidas} ${naoLidas === 1 ? 'não lida' : 'não lidas'}`;
};
