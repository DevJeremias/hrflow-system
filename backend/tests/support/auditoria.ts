// A autoria de uma ação chamada direto no serviço (sem passar por uma requisição).
import type { Autoria } from '../../shared/utils/auditar.ts';

export const autoriaDeTeste = (empresaId: number, usuarioId: number | null = null): Autoria => ({
    empresaId, usuarioId, nome: 'Autor Ficticio', perfil: 'Administrador', ip: '127.0.0.1',
});
