// Captura da posição para a marcação de ponto. O navegador só chama os callbacks quando a pessoa
// responde ao aviso de permissão: sem prazo, ignorar o aviso deixaria o botão girando para sempre.
export const PRAZO_DA_LOCALIZACAO_MS = 15_000;

export interface Localizacao {
  lat: number;
  lng: number;
}

// Códigos de GeolocationPositionError (a especificação os define como constantes da interface).
const PERMISSAO_NEGADA = 1;
const PRAZO_ESGOTADO = 3;

export const mensagemDeLocalizacao = (codigo: number): string => {
  if (codigo === PERMISSAO_NEGADA) return 'Permita o acesso à sua localização no navegador para registrar o ponto.';
  if (codigo === PRAZO_ESGOTADO) return 'Não foi possível obter a sua localização a tempo. Tente novamente.';
  return 'Não foi possível obter a sua localização. Verifique o GPS e tente novamente.';
};

export const obterLocalizacao = (
  geolocalizacao: Pick<Geolocation, 'getCurrentPosition'> | undefined = typeof navigator === 'undefined' ? undefined : navigator.geolocation,
): Promise<Localizacao> => new Promise((resolve, reject) => {
  if (!geolocalizacao) {
    reject(new Error('O seu navegador não suporta geolocalização.'));
    return;
  }
  geolocalizacao.getCurrentPosition(
    ({ coords }) => resolve({ lat: coords.latitude, lng: coords.longitude }),
    ({ code }) => reject(new Error(mensagemDeLocalizacao(code))),
    { enableHighAccuracy: true, timeout: PRAZO_DA_LOCALIZACAO_MS, maximumAge: 0 },
  );
});
