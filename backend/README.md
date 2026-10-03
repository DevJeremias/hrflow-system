# Back-end do HRFlow

API REST em Node.js com Express e MySQL. Este README descreve a estrutura do código e as regras que o lint e o CI fazem valer; a instalação, o banco e os testes estão no README da raiz.

## Estrutura

O back-end é um monólito modular escrito inteiramente em TypeScript, com módulos ES.

```text
backend/
├── app.ts                  # criarApp: monta o app Express (parsers, rotas de cada módulo, tratador de erros)
├── server.ts               # ponto de entrada: carrega o .env, testa o banco, abre a porta e encerra limpo no SIGTERM
├── modules/<área>/         # uma pasta por área do domínio, em camadas (padrão abaixo)
├── shared/                 # o que mais de uma área usa
│   ├── config/             # segredo JWT, leitura de TRUST_PROXY
│   ├── db/                 # pool do MySQL, aplicador de migrations, fixtures de desenvolvimento
│   ├── middlewares/        # autenticação, perfis, validação de entrada, limites de tentativas, erros
│   ├── schemas/            # blocos zod comuns, regras de texto, e-mail e senha, paginação
│   └── utils/              # tradução de erros do MySQL, paginação das respostas
├── migrations/             # schema versionado (SQL numerado) e auditorias; não é código
├── tests/                  # testes de integração e de unidade (*.test.ts)
└── types/                  # declarações que só o tsc usa (express.d.ts)
```

As áreas são `auth`, `dashboard`, `empresa`, `estrutura`, `folha`, `funcionarios`, `perfil`, `ponto`, `saude` (health e ready, só rotas) e `usuarios` (contas de acesso, só do Administrador). `modules/ponto` é a implementação de referência: para uma área nova, copie a estrutura dela.

## Regras de estrutura

O `npm run lint` (na raiz ou aqui) e o CI fazem valer o que segue. Os testes das regras estão em `tests/estruturaGuardas.test.ts`.

* **Código novo vai em `modules/<área>` ou `shared/`.** Na raiz só existem `app.ts`, `server.ts`, `modules/`, `shared/`, `migrations/`, `tests/` e `types/`. Uma pasta nova como `controllers/`, `routes/` ou `utils/` na raiz é recusada pela regra `estrutura/codigo-no-lugar` do `eslint.config.mjs`.
* **Uma área só importa outra pelo `index.ts` dela.** `modules/ponto` pode importar `../auth/index.ts`, nunca `../auth/auth.service.ts`: o interior de uma área muda sem aviso, o `index.ts` é o contrato. Vale também para `import type`. A regra é o `no-restricted-imports` do `eslint.config.mjs`, gerado a partir das pastas de `modules/`, então uma área nova entra sozinha.
* **O que duas áreas precisam vai para `shared/`.** Quando uma área importa de outra só para reaproveitar uma regra (como os limites e as validações de texto, e-mail e senha, hoje em `shared/schemas/validadores.ts`), o certo é mover a regra para `shared/`, não abrir o interior da outra área.
* **Nada de `.js` nem `.jsx` em `backend/` ou `frontend/`.** A guarda `scripts/guardar-estrutura.mts` falha o lint e o CI. As únicas exceções são as configurações de ferramenta do front-end que só são lidas em JavaScript, listadas em `CONFIGURACOES_PERMITIDAS` no próprio script; um arquivo novo só entra nessa lista se a ferramenta exigir.

Dependência conhecida que o lint não cobre: `shared/middlewares/authMiddleware.ts` importa `modules/auth/auth.sessao.ts` (a leitura do token e do CSRF), então `shared/` ainda depende de uma área. Importa o arquivo, não o `index.ts`, porque o `index.ts` monta o router de auth, que importa o próprio `authMiddleware`.

## Estrutura de um módulo

```text
modules/ponto/
├── index.ts              # superfície pública: o que o resto da aplicação importa
├── ponto.routes.ts       # caminhos, middlewares de acesso e validação, e o controlador de cada rota
├── ponto.controller.ts   # camada HTTP: lê a requisição, chama o serviço, escreve a resposta
├── ponto.service.ts      # regras de negócio e orquestração; não conhece HTTP
├── ponto.repository.ts   # todo o SQL; não conhece HTTP nem regra
├── ponto.schemas.ts      # schemas zod da entrada (params, body, query) e os tipos que eles entregam
├── ponto.erros.ts        # falhas de regra do módulo (ErroDePonto)
├── ponto.regras.ts       # regras puras, sem banco (sequência das marcações, coordenadas, apuração do dia e do mês)
└── ponto.fuso.ts         # utilitário de data e hora do módulo
```

Cada camada só conhece a de baixo:

```text
rotas -> controlador -> serviço -> repositório -> banco
```

* **Rotas** montam o `Router`. Autorização por perfil (`exigirPermissao`, que lê a matriz de `shared/utils/permissoes.ts` documentada em `docs/permissoes.md`; `verificarPerfil`; `verificarAcessoFuncionario`) e validação de entrada (`validarEntrada` com os schemas do módulo) ficam aqui, antes do controlador. O `authMiddleware` é aplicado no `app.ts`, ao montar o módulo.
* **Controlador** é fino: extrai da requisição o que o serviço precisa (a empresa e o colaborador vêm do token em `req.usuario`, nunca do corpo), chama uma função do serviço e responde. Não tem regra nem SQL.
* **Serviço** decide. Recebe parâmetros simples, devolve o formato que o front-end consome e lança `ErroDePonto` quando uma regra recusa a operação. O tipo do erro (`proibido`, `invalido`, `inexistente`, `conflito`) diz o que aconteceu; quem o transforma em status HTTP (403, 400, 404, 409) é o controlador.
* **Repositório** executa as consultas e devolve as linhas como o MySQL as entrega. `emTransacao` reserva uma conexão, confirma se o trabalho terminar e desfaz se ele lançar erro; o repositório que ele entrega usa essa conexão, e é assim que o serviço mantém uma regra e a escrita dela na mesma transação.
* **Falhas inesperadas** viram 500 com a mensagem do endpoint. Onde o endpoint já traduzia erros do MySQL em 4xx e 503 (`shared/utils/erros.ts`), o controlador liga `traduzirBanco`.

## TypeScript sem etapa de build

O Node 22.18 ou superior executa arquivos `.ts` tirando os tipos na hora, então `npm start`, `npm run dev` e `npm test` rodam o código-fonte direto, sem compilar. O `tsc` só confere os tipos, de código e de testes com um único `tsconfig.json` (`strict`): `npm run typecheck` aqui confere o back-end, e na raiz confere front-end e back-end e faz parte do `npm run verify`.

Como o Node só apaga os tipos, o código precisa ser o que a remoção de tipos suporta (`erasableSyntaxOnly` no `tsconfig.json` recusa o resto):

* Nada de `enum`, `namespace` com código, propriedades de parâmetro de construtor (`constructor(private x)`), `import x = require()` nem asserção `<T>valor` (use `valor as T`).
* `import type` para o que só existe nos tipos.
* Imports relativos levam a extensão real do arquivo: `./ponto.service.ts`.
* Use exports nomeados, exceto onde o arquivo tem uma única coisa a oferecer (o pool, os middlewares), que usa `export default`.
* O que os middlewares penduram na requisição (`req.usuario`, `req.dadosValidados`) é declarado em `types/express.d.ts`. Os campos são opcionais porque só existem depois do middleware: o controlador confere em vez de presumir.
* Os construtores de `shared/schemas/comum.ts` declaram o tipo que devolvem, e o tipo do que cada schema entrega continua escrito à mão em `<área>.schemas.ts`. Mantenha os dois juntos.
* O pool e o segredo JWT leem o ambiente ao serem carregados. Em `server.ts` o `import 'dotenv/config'` vem antes de tudo por isso, e nos testes o `support/bancoDeTeste.ts` é sempre o primeiro import: o ESM avalia os imports na ordem em que aparecem.

## Testes

Os testes ficam em `tests/` e são todos TypeScript (`*.test.ts`), rodados pelo `node --test`. Os de integração usam um MySQL real (veja o README da raiz). Ao migrar ou mover código:

* Teste a API pelo app de verdade: `criarApp()` (de `app.ts`) devolve o mesmo app que o `server.ts` escuta, com os prefixos, os parsers e o `authMiddleware` no lugar. Não monte rotas à mão num `express()` de teste: uma rota esquecida sem `authMiddleware` passaria em todos os testes. `criarApp` aceita `db` (o banco que o `/api/ready` consulta; os repositórios usam o pool compartilhado), `limitesAuth` e `trustProxy`, e `tests/support/servidor.ts` sobe o app numa porta livre.
* Cada arquivo de teste de integração começa por `import * as banco from './support/bancoDeTeste.ts'` e chama `banco.preparar()`: o banco do arquivo (`hrflow_test_<pid>`) nasce como cópia do molde que `tests/support/executar.ts` (o `npm test`) migrou uma vez por execução; o `--test-global-setup` do Node faria o mesmo, mas só existe a partir do Node 24. Os arquivos rodam quatro de cada vez (`--test-concurrency=4`), e a trava das migrations é por banco (`hrflow_migracoes_<DB_NAME>`), então migrar bancos diferentes não faz fila. O que o clone não copia (views, rotinas, eventos) faz `clonarBanco` falhar, em vez de sair incompleto.
* `npm run test:cobertura` mede a cobertura de linhas de `app.ts`, `server.ts`, `modules/` e `shared/`; o `verify` da raiz exige 90%.
* Os testes existentes devem passar sem mudar nenhuma asserção. Só mudam os imports que apontam para os arquivos movidos.
* Para fixar "agora", o serviço expõe `relogio.agora`; o teste a substitui e a restaura no fim.
* Renomeações mecânicas (mover arquivos e ajustar caminhos) vão num commit separado, antes das mudanças de conteúdo, para o histórico mostrar edições em vez de arquivos novos.

## Roteiro para um módulo novo

1. Crie `modules/<nome>/` com os arquivos acima. Comece pelo que depende só do domínio (regras puras, schemas) e termine nas rotas.
2. Ponha as consultas no repositório e as regras no serviço.
3. Exponha só as rotas em `index.ts` e monte-as no `app.ts`, mantendo o `authMiddleware` ali.
4. Escreva os testes em `tests/` e rode `npm run lint`, `npm run typecheck` e `npm test`.
