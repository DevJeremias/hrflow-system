# Back-end do HRFlow

API REST em Node.js com Express e MySQL. Este README descreve o padrão dos módulos novos; a instalação, o banco e os testes estão no README da raiz.

## Estado atual

O back-end está sendo reorganizado como um monólito modular, módulo por módulo. Convivem dois formatos:

* **Código legado em JavaScript (CommonJS):** `controllers/`, `routes/`, `schemas/`, `utils/` e `middlewares/`, que ainda misturam HTTP, regra e SQL no controlador. Nada disso muda até o módulo correspondente ser migrado.
* **Módulos em TypeScript:** `modules/<nome>/`, um por área do domínio. O primeiro é `modules/ponto`, a implementação de referência; `modules/dashboard` e `modules/folha` já seguem o padrão. Para escrever um módulo novo, copie a estrutura dele.

Migre um módulo inteiro por vez, sem reescrever os outros.

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
├── ponto.regras.ts       # regras puras, sem banco (sequência das marcações, coordenadas)
└── ponto.fuso.ts         # utilitário de data e hora do módulo
```

Cada camada só conhece a de baixo:

```text
rotas -> controlador -> serviço -> repositório -> banco
```

* **Rotas** montam o `Router`. Autorização por perfil (`verificarPerfil`, `verificarAcessoFuncionario`) e validação de entrada (`validarEntrada` com os schemas do módulo) ficam aqui, antes do controlador. O `authMiddleware` é aplicado no `server.js`, ao montar o módulo.
* **Controlador** é fino: extrai da requisição o que o serviço precisa (a empresa e o colaborador vêm do token em `req.usuario`, nunca do corpo), chama uma função do serviço e responde. Não tem regra nem SQL.
* **Serviço** decide. Recebe parâmetros simples, devolve o formato que o front-end consome e lança `ErroDePonto` quando uma regra recusa a operação. O tipo do erro (`proibido`, `invalido`, `inexistente`, `conflito`) diz o que aconteceu; quem o transforma em status HTTP (403, 400, 404, 409) é o controlador.
* **Repositório** executa as consultas e devolve as linhas como o MySQL as entrega. `emTransacao` reserva uma conexão, confirma se o trabalho terminar e desfaz se ele lançar erro; o repositório que ele entrega usa essa conexão, e é assim que o serviço mantém uma regra e a escrita dela na mesma transação.
* **Falhas inesperadas** viram 500 com a mensagem do endpoint. Onde o endpoint já traduzia erros do MySQL em 4xx e 503 (`utils/erros.js`), o controlador liga `traduzirBanco`.

## TypeScript sem etapa de build

O Node 22.18 ou superior executa arquivos `.ts` tirando os tipos na hora, então `npm start`, `npm run dev` e `npm test` rodam o código-fonte direto, sem compilar. O `tsc` só confere os tipos: `npm run typecheck` aqui confere o back-end, e na raiz confere front-end e back-end e faz parte do `npm run verify`.

Como o Node só apaga os tipos, o código precisa ser o que a remoção de tipos suporta (`erasableSyntaxOnly` no `tsconfig.json` recusa o resto):

* Nada de `enum`, `namespace` com código, propriedades de parâmetro de construtor (`constructor(private x)`) nem `import x = require()`.
* `import type` para o que só existe nos tipos.
* Imports relativos levam a extensão real do arquivo: `./ponto.service.ts` para TypeScript e `../../config/db.js` para JavaScript.
* Use exports nomeados. `modules/package.json` marca a pasta como módulo ES, e o código CommonJS pede o módulo com `require('./modules/ponto/index.ts')` e desestrutura o que precisa (`const { pontoRoutes } = require(...)`).

Os arquivos JavaScript importados por um módulo (`config/db.js`, `schemas/comum.js`, os middlewares) são lidos pelo `tsc` com os tipos que ele infere, sem conferi-los (`checkJs` desligado). Duas consequências:

* O que os middlewares penduram na requisição (`req.usuario`, `req.dadosValidados`) é declarado em `types/express.d.ts`. Os campos são opcionais porque só existem depois do middleware: o controlador confere em vez de presumir.
* Os construtores de `schemas/comum.js` não declaram o tipo que devolvem, então o tipo do que cada schema entrega é escrito à mão em `ponto.schemas.ts`. Mantenha os dois juntos. Migrar `schemas/comum.js` para TypeScript permite derivar os tipos com `z.infer`.

## Testes

Os testes de integração ficam em `tests/`, contra um MySQL real (veja o README da raiz), e os do módulo migrado são TypeScript (`*.test.ts`, rodados pelo mesmo `node --test`). Como `tests/` ainda mistura arquivos CommonJS, o `tsc` confere os `.ts` com o `tests/tsconfig.json` (módulos ES), e `npm run typecheck` roda as duas conferências. Ao migrar um módulo:

* Os testes existentes devem passar sem mudar nenhuma asserção. Só mudam os `require` que apontam para os arquivos movidos.
* Para fixar "agora", o serviço expõe `relogio.agora`; o teste a substitui e a restaura no fim.
* Renomeações mecânicas (mover arquivos e ajustar caminhos) vão num commit separado, antes das mudanças de conteúdo, para o histórico mostrar edições em vez de arquivos novos.

## Roteiro para um módulo novo

1. Crie `modules/<nome>/` com os arquivos acima. Comece pelo que depende só do domínio (regras puras, schemas) e termine nas rotas.
2. Mova as consultas do controlador antigo para o repositório e as regras para o serviço. Duplicação que os testes já cobrem pode ser unificada; mudar o que a API responde, não.
3. Exponha só as rotas em `index.ts` e troque o `require` no `server.js`, mantendo o `authMiddleware` ali.
4. Aponte os testes para os arquivos novos e rode `npm run typecheck` e `npm test`.
5. Remova o controlador, as rotas, os schemas e os utilitários antigos que deixaram de ter uso.
