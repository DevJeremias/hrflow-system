# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Proxy da API

Durante o desenvolvimento, o Vite encaminha as chamadas `/api` para `http://localhost:3000` por padrão. Para usar a API em outro endereço, defina `VITE_API_PROXY_TARGET` antes de iniciar o front-end, por exemplo:

```bash
VITE_API_PROXY_TARGET=http://localhost:3000 npm run dev
```

## Design system

Os tokens Ponto, os dois temas, os componentes, os guardrails de lint e os padrões responsivos estão documentados em [`docs/design-system.md`](../docs/design-system.md). Geist e Geist Mono são carregadas localmente. `npm run lint` valida CSS, classes e estilos inline; os snapshots da suíte E2E cobrem as telas principais em 360 px e 1280 px.

Os componentes compartilhados vivem em `src/components/ui`; telas novas os usam em vez de classes soltas:

| Componente | Uso |
| --- | --- |
| `Button`, `IconButton` | todo botão; `IconButton` exige `label` (nome acessível) |
| `Field` com `Input`, `Select`, `Textarea` | todo campo de formulário; `Field` liga `<label for>`, `id`, `name` e as descrições aria |
| `Modal`, `ConfirmDialog` | janelas: `role="dialog"`, foco preso, Esc, fundo inerte, foco devolvido a quem abriu; `useConfirm()` no lugar de `confirm()` |
| `ToastProvider`, `useToast()` | feedback de ação no lugar de `alert()` |
| `DataTable` | tabelas; abaixo do ponto de quebra cada linha vira cartão com todas as colunas |
| `Tabs`, `TabPanel` | abas WAI-ARIA com setas, Home e End |
| `PageHeader`, `Card`, `StatCard`, `Badge`, `Avatar`, `EmptyState`, `Spinner`, `Skeleton` | estrutura e estados da página |

`usePageTitle('Nome da página')` define o `<title>` de cada rota (`Nome | HRFlow`). O `Layout` é o único dono do `<main>`.

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
