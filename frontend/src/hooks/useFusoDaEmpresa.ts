import { useContext } from 'react';
import { AuthContext } from '../contexts/sessaoContext';
import { FUSO_PADRAO } from '../utils/fuso';

// O fuso IANA da empresa da sessão, que define o "dia" do ponto e o "mês" da folha. Fora de um
// AuthProvider (nos testes das telas, por exemplo) vale o padrão.
export const useFusoDaEmpresa = (): string => useContext(AuthContext)?.user?.empresaFuso ?? FUSO_PADRAO;
