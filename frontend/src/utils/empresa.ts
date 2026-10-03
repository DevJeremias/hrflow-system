// CNPJ: a API guarda e devolve só os 14 dígitos; a tela mostra e digita com a máscara 00.000.000/0000-00.
export const mascararCnpj = (valor: string): string => {
  const digitos = valor.replace(/\D/g, '').slice(0, 14);
  return digitos
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
};
