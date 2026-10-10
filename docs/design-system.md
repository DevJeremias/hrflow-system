# Design system do HRFlow

A direção visual do frontend é Ponto: interface operacional escura e densa, com acentos âmbar, tipografia Geist e hierarquia discreta. O portal do colaborador e as páginas legais usam o tema claro. O holerite continua sendo um documento claro, inclusive quando aberto dentro do tema escuro.

## Tokens

Os valores ficam em `frontend/src/index.css` como propriedades CSS e são expostos pelo Tailwind em `frontend/tailwind.config.js`. Use os nomes semânticos, não valores literais.

| Token | Uso |
| --- | --- |
| `brand`, `brand-fill`, `brand-fill-hover` | Identidade, ação principal, foco de navegação e tendência do gráfico. O âmbar `#F2B33D` é reservado à marca. Texto de marca usa `text-brand`, que mantém contraste no tema claro. |
| `warning`, `danger` | Avisos, pendências, atrasos e ações destrutivas. No tema escuro usam coral `#FF7A6E`; no tema claro, coral escurecido para manter contraste. O rótulo e o ícone acompanham a cor. |
| `success`, `info` | Confirmações e informação, sempre com texto além da cor. |
| `surface`, `surface-muted`, `surface-sunken` | Superfície de painel, fundo de página e superfície rebaixada. |
| `ink`, `ink-muted`, `ink-subtle` | Texto primário, auxiliar e terciário. Confirme contraste AA nos dois temas. |
| `line`, `line-strong`, `line-input`, `focus` | Divisórias, limites de campos e foco visível. Campos usam `line-input`; foco não depende apenas da cor de marca. |
| `document-*` | Papel, tinta, linhas e descontos do holerite. Não use estes tokens em painéis comuns. |
| `shadow-card`, `shadow-raised`, `shadow-modal` | Elevação de cartões, controles elevados e diálogos. |
| `rounded-control`, `rounded-card`, `rounded-modal` | Raio de 6 px para controles, cartões e modais. Use `rounded-full` somente para círculos funcionais, como avatares e indicadores. |
| `font-sans`, `font-mono` | Geist para interface e Geist Mono para competências, valores e identificadores. |

O tamanho mínimo de texto é 12 px. O espaço usa a escala padrão do Tailwind. Não crie outro degrau para resolver um caso isolado.

## Temas

A aplicação usa o tema escuro por padrão. `Layout` seleciona o tema claro da área `/meu-painel`; páginas legais aplicam `data-theme="light"` ao documento de leitura. O holerite usa os tokens `document-*` e permanece em papel claro.

A navegação lateral usa `data-escuro`: seus tokens permanecem escuros mesmo dentro do portal claro. Não altere a paleta por perfil em cada componente.

## Componentes e padrões

Use os componentes compartilhados de `frontend/src/components/ui` antes de criar outro controle:

- `Button`, `IconButton` e `Field` para ações e formulários acessíveis.
- `Card`, `StatCard`, `Badge`, `DataTable`, `Tabs` e `Avatar` para conteúdo estruturado.
- `EmptyState`, `Skeleton`, `ErrorAlert`, `Toast` e `Modal` para estados e feedback.
- `Modal` é o diálogo central padrão. Para cadastro que precisa manter a lista visível, use `presentation="right"`. O painel ocupa a altura da janela, tem largura máxima de 520 px e reutiliza a mesma proteção de foco, fechamento por Escape, fundo inerte e nome acessível.
- `GraficoDeHeadcount` apresenta a tendência em linha, com eixo vertical ajustado. Para séries no intervalo ilustrado, os limites são 215 e 250; outras séries recebem um domínio ajustado aos próprios dados. A tabela equivalente para leitor de tela é obrigatória.

Toda tela deve ter estados de carregamento, erro recuperável e vazio quando aplicável. Não represente erro como lista vazia. Status não dependem exclusivamente da cor.

## Guardrails obrigatórios

`npm run lint` roda ESLint e a verificação CSS. Ela reprova cores, sombras, raios, espaçamentos e tipografia arbitrários em classes Tailwind, valores visuais literais em CSS e estilos inline fora das exceções abaixo. `npm run verify` inclui o lint. Não desligue a regra para fazer uma tela passar.

Use classes semânticas e componentes de `components/ui`. Não importe bibliotecas de componentes visuais como MUI, Chakra, Headless UI, Ant Design ou React Bootstrap. Componentes de `components/ui` não podem depender de páginas, layouts ou componentes de produto.

Exceções existentes, limitadas ao uso funcional:

- `Hero.tsx` usa `transform` inline para deslocar o carrossel.
- `Login.tsx` usa `backgroundImage` inline para a imagem da tela de acesso.
- `index.css` define os tokens e usa a margem de impressão de 12 mm do holerite A4, isolada por `.holerite-impressao`.

Para mudar o visual de um componente ou tela, rode os snapshots de regressão visual da suíte E2E em 360 px e 1280 px. Atualize snapshots somente quando a diferença for intencional e revisável. O template de PR inclui o checklist visual.

## Linha sugerida para o AGENTS.md do projeto

`Para alterações visuais no frontend, siga o guia [Design System](docs/design-system.md); o lint e os snapshots visuais são obrigatórios.`
