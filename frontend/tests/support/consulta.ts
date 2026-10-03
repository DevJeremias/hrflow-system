// Um QueryClient para renderizar telas nos testes. Sem retry, o erro simulado aparece na hora; com
// gcTime infinito (consultas e mutações) não sobra timer de coleta de 5 minutos segurando o
// processo do teste.
import { createElement, act, type ReactElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export const novoQueryClient = () => new QueryClient({
  defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } },
});

export const comConsulta = (elemento: ReactElement, cliente: QueryClient = novoQueryClient()): ReactElement =>
  createElement(QueryClientProvider, { client: cliente }, elemento);

// O TanStack Query avisa os componentes em um timer: depois de uma resposta simulada, a tela só
// reflete o resultado depois de um instante.
export const assentar = (ms = 20) => act(async () => { await new Promise((resolve) => setTimeout(resolve, ms)); });
