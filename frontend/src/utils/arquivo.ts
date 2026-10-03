// Entrega ao navegador um arquivo que a API gerou (o PDF do holerite): cria o link de download, clica
// nele e solta a URL. A sessão é cookie, então o arquivo precisa vir por uma chamada autenticada e
// não por um link direto, que mostraria o JSON de erro numa aba nova.
export const baixarArquivo = (arquivo: Blob, nome: string): void => {
  const url = URL.createObjectURL(arquivo);
  const link = document.createElement('a');
  link.href = url;
  link.download = nome;
  document.body.append(link);
  link.click();
  link.remove();
  // O download já começou quando o clique retorna; revogar no mesmo instante cancela em alguns navegadores.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

// O nome que o servidor sugeriu em Content-Disposition, ou o reserva.
export const nomeSugerido = (resposta: Response | null, reserva: string): string =>
  /filename="([^"]+)"/.exec(resposta?.headers.get('Content-Disposition') ?? '')?.[1] ?? reserva;
