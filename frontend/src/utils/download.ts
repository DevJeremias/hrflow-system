// Entrega um JSON ao navegador como arquivo para baixar.
export const baixarJson = (nomeDoArquivo: string, dados: unknown): void => {
  const endereco = URL.createObjectURL(new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = endereco;
  link.download = nomeDoArquivo;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(endereco);
};
