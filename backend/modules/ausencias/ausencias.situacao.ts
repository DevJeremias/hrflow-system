// A situação do colaborador que a ausência aprovada produz. Ela é lida, não gravada: funcionarios.status
// guarda só o que o RH decidiu (Ativo, Inativo, Férias), e quem lista colaboradores troca esse Ativo
// por Férias ou Afastado enquanto houver uma ausência aprovada cobrindo o dia. Assim o primeiro dia
// de férias e o dia seguinte ao último valem sem job que acorde na hora certa, e uma aprovação ou
// uma data corrigida vale na leitura seguinte.
import { TIPOS, situacaoDoTipo } from './ausencias.regras.ts';

const comSituacao = TIPOS.filter((tipo) => situacaoDoTipo(tipo) !== null);

// Expressão SQL da situação de `alias` (a tabela funcionarios na consulta de quem usa), com um único
// marcador `?` para o dia de hoje ('AAAA-MM-DD'). Os tipos vêm de constantes do código, nunca do cliente.
export const situacaoEfetivaSql = (alias: string): string => `CASE WHEN ${alias}.status = 'Ativo' THEN COALESCE(
    (SELECT CASE a.tipo WHEN 'Férias' THEN 'Férias' ELSE 'Afastado' END
     FROM ausencias a
     WHERE a.funcionario_id = ${alias}.id AND a.empresa_id = ${alias}.empresa_id AND a.status = 'Aprovada'
       AND a.tipo IN (${comSituacao.map((tipo) => `'${tipo}'`).join(', ')})
       AND ? BETWEEN a.data_inicio AND a.data_fim
     LIMIT 1), 'Ativo')
    ELSE ${alias}.status END`;
