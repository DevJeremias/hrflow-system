// Cliente HTTP dos testes que sobem o app inteiro (criarApp): monta a requisição como o front-end a
// faria, com o cookie da sessão e o token CSRF, e devolve status, corpo JSON (null se vazio) e a resposta.
import { cabecalhosDaSessao, tokenDaResposta } from './sessao.ts';

export const criarCliente = (baseUrl: string) => async (metodo: string, caminho: string, token?: string | null, corpo?: unknown) => {
    const resposta = await fetch(`${baseUrl}${caminho}`, {
        method: metodo,
        headers: { 'Content-Type': 'application/json', ...cabecalhosDaSessao(token) },
        body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });
    const texto = await resposta.text();
    return { status: resposta.status, corpo: texto ? JSON.parse(texto) : null, resposta, token: tokenDaResposta(resposta) };
};

export type Cliente = ReturnType<typeof criarCliente>;
