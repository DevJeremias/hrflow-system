// O que os middlewares em JavaScript penduram na requisição. Opcional porque só existe depois
// deles: os handlers conferem em vez de presumir.
declare global {
    namespace Express {
        interface Request {
            // Claims do token, preenchidas por middlewares/authMiddleware.js (ver utils/sessao.js).
            usuario?: {
                id: number;
                perfil: string;
                empresa_id: number;
                funcionario_id: number | null;
                nome: string;
                sv: number;
            };
            // Entrada que o schema da rota aceitou e normalizou, preenchida por middlewares/validarEntrada.js.
            dadosValidados?: { params?: unknown; body?: unknown; query?: unknown };
        }
    }
}

export {};
