import { useQuery } from '@tanstack/react-query';
import { generateMonthlyPayroll, getMyPayroll } from '../services/payrollService';
import { chaves } from './chaves';

// A folha é calculada com os dados atuais: não depende de mês nem de filtro, então um único
// cache serve a tela inteira e o filtro por setor trabalha sobre ele, sem nova chamada.
export const useFolhaDaEmpresa = () => useQuery({ queryKey: chaves.folhaDaEmpresa, queryFn: generateMonthlyPayroll });

export const useMeuHolerite = () => useQuery({ queryKey: chaves.meuHolerite, queryFn: getMyPayroll });
