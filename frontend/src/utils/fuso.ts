// O fuso horário da empresa (empresas.fuso na API): o "dia" do ponto e o "mês" da folha seguem o dela,
// não o do navegador. Sem sessão ou com uma API anterior a este campo vale Belém, o fuso padrão.
export const FUSO_PADRAO = 'America/Belem';

// Os fusos que a API aceita, com a cidade que o usuário reconhece.
export const FUSOS_DO_BRASIL = [
  { zona: 'America/Noronha', cidade: 'Fernando de Noronha' },
  { zona: 'America/Sao_Paulo', cidade: 'Brasília e São Paulo' },
  { zona: 'America/Bahia', cidade: 'Salvador' },
  { zona: 'America/Fortaleza', cidade: 'Fortaleza' },
  { zona: 'America/Recife', cidade: 'Recife' },
  { zona: 'America/Maceio', cidade: 'Maceió' },
  { zona: 'America/Araguaina', cidade: 'Araguaína' },
  { zona: 'America/Belem', cidade: 'Belém' },
  { zona: 'America/Santarem', cidade: 'Santarém' },
  { zona: 'America/Campo_Grande', cidade: 'Campo Grande' },
  { zona: 'America/Cuiaba', cidade: 'Cuiabá' },
  { zona: 'America/Porto_Velho', cidade: 'Porto Velho' },
  { zona: 'America/Boa_Vista', cidade: 'Boa Vista' },
  { zona: 'America/Manaus', cidade: 'Manaus' },
  { zona: 'America/Eirunepe', cidade: 'Eirunepé' },
  { zona: 'America/Rio_Branco', cidade: 'Rio Branco' },
] as const;

export const cidadeDoFuso = (zona: string): string => FUSOS_DO_BRASIL.find((fuso) => fuso.zona === zona)?.cidade ?? zona;

// "Manaus (GMT-4)": a cidade e o deslocamento em relação ao UTC, que o runtime calcula.
export const rotuloDoFuso = (zona: string, agora: Date = new Date()): string => {
  const deslocamento = new Intl.DateTimeFormat('en-US', { timeZone: zona, timeZoneName: 'shortOffset' })
    .formatToParts(agora).find((parte) => parte.type === 'timeZoneName')?.value ?? '';
  return `${cidadeDoFuso(zona)} (${deslocamento})`;
};
