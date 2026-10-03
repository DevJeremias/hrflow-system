// Superfície pública do módulo: o que o resto da aplicação pode importar.
export { ausenciasRoutes } from './ausencias.routes.ts';
// Os colaboradores listados mostram Férias ou Afastado enquanto uma ausência aprovada cobre o dia.
export { situacaoEfetivaSql } from './ausencias.situacao.ts';
export { hojeEmBelem, feriasAprovadasNoPeriodo } from './ausencias.service.ts';
// O anexo de até 5 MB cresce um terço em base64; o corpo aceita o dobro do limite para o 400 do anexo vir da validação e não do parser.
export { LIMITE_DO_CORPO_DE_AUSENCIAS } from './ausencias.anexo.ts';
