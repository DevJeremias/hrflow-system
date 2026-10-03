# Matriz de permissões

Quem pode o quê no HRFlow. A fonte no código é `backend/shared/utils/permissoes.ts`; as rotas pedem a ação por nome (`exigirPermissao`) e `backend/tests/permissoes.test.ts` confere cada linha da tabela abaixo contra a API real, com uma identidade de cada perfil.

## Perfis

| Perfil | Quem é | Cadastro de funcionário |
| --- | --- | --- |
| Administrador | Dono da conta da empresa. Cria RH e outros Administradores, e cuida da estrutura (departamentos e cargos). | Opcional |
| RH | Gere colaboradores e folha. Não altera acessos nem estrutura. | Opcional; com ele, bate ponto e vê o próprio holerite |
| Colaborador | Pessoa com cadastro de funcionário. Vê só o que é dela. | Sempre |

Quem tem cadastro de funcionário (`funcionario_id` na sessão) bate ponto e vê o próprio holerite **em qualquer perfil**. Quem não tem (um Administrador sem cadastro) não vê "Meu ponto" nem "Meu holerite".

## Rotas

`200` quer dizer que a rota é permitida (a resposta de sucesso é 200, 201 ou 204, conforme a rota); `403` é "Acesso negado". Sem sessão, toda rota responde `401`.

| Rota | Administrador | RH | Colaborador |
| --- | --- | --- | --- |
| `GET /api/usuarios` | 200 | 403 | 403 |
| `POST /api/usuarios` | 200 | 403 | 403 |
| `PATCH /api/usuarios/:id` | 200 | 403 | 403 |
| `GET /api/estrutura/departamentos`, `GET /api/estrutura/cargos` | 200 | 200 | 403 |
| `POST`, `PUT`, `DELETE` em `/api/estrutura/departamentos` e `/api/estrutura/cargos` | 200 | 403 | 403 |
| `GET /api/empresa` | 200 | 200 | 403 |
| `PUT /api/empresa` | 200 | 403 | 403 |
| `GET /api/funcionarios` | 200 | 200 | 403 |
| `POST /api/funcionarios` (cria Colaborador) | 200 | 200 | 403 |
| `PUT /api/funcionarios/:id`, `DELETE /api/funcionarios/:id`, `PATCH /api/funcionarios/:id/status`, `POST /api/funcionarios/:id/redefinir-senha` | 200 em qualquer cadastro (status e senha, menos no próprio) | 200 em cadastro de Colaborador; 403 no próprio, no de RH e no de Administrador | 403 |
| `GET /api/folha/competencias/:competencia`, `POST .../processar`, `POST .../fechar` | 200 | 200 | 403 |
| `GET /api/folha/meu-holerite`, `GET /api/folha/meus-holerites` | 200 se tem cadastro | 200 se tem cadastro | 200 |
| `GET /api/ponto`, `GET /api/ponto/justificativas` | 200 | 200 | 403 |
| `POST /api/ponto/registrar`, `PUT /api/ponto/justificativa/:data` | 200 se tem cadastro | 200 se tem cadastro | 200 |
| `GET /api/ponto/hoje\|historico\|totais/:funcionarioId` | 200 de qualquer um | 200 de qualquer um | 200 só do próprio |
| `GET /api/dashboard/resumo` | 200 | 200 | 403 |
| `GET /api/perfil/meus-dados`, `PUT /api/perfil/meus-dados`, `PUT /api/perfil/alterar-senha` | 200 | 200 | 200 |
| `GET /api/notificacoes`, `POST /api/notificacoes/lidas`, `POST /api/notificacoes/:id/lida` | 200, só os próprios avisos | 200, só os próprios avisos | 200, só os próprios avisos |

Decisões que a tabela esconde:

* **O RH lê a estrutura e os dados da empresa, o Administrador os altera.** O RH precisa dos cargos e departamentos para cadastrar um colaborador e dos dados da empresa para conferir a folha; criar, renomear, apagar ou editar continua com o Administrador.
* **O RH não se promove nem apaga colegas.** Ele não altera o próprio cadastro (salário, status, qualquer campo; os dados pessoais ele muda em `PUT /api/perfil/meus-dados`) nem o de quem tem conta de RH ou de Administrador. O que o RH pode editar é o cadastro de Colaborador.
* **Senha provisória**: a conta criada ou redefinida entra com a senha provisória, e a sessão dela só alcança a troca de senha (`PUT /api/perfil/alterar-senha`) até a pessoa definir a própria.
* **Ninguém exclui o próprio cadastro**, nem o Administrador: a conta cairia junto e a empresa poderia ficar sem quem a administre.
* **RH e Administrador nascem em `POST /api/usuarios`**, só pelo Administrador, com senha provisória gerada pelo servidor e devolvida uma única vez. Para dar acesso de RH a quem já é colaborador (a Rita), o Administrador muda o perfil dessa conta em `PATCH /api/usuarios/:id`; o cadastro de funcionário continua o mesmo, então a pessoa mantém ponto e holerite.
* **O Administrador não altera o próprio perfil nem redefine a própria senha por `/api/usuarios`**, para não se trancar fora; a troca da própria senha é em `PUT /api/perfil/alterar-senha`.
* **Conta com cadastro de funcionário** muda nome e e-mail no cadastro do colaborador, não em `/api/usuarios`.

## Menu

| Item | Administrador | RH | Colaborador |
| --- | --- | --- | --- |
| Dashboard, Colaboradores, Folha de Pagamento, Empresa, Gestão de Ponto | sim | sim | não |
| Depto & Cargos, Usuários | sim | não | não |
| Meu ponto, Meu holerite | se tem cadastro | se tem cadastro | sim |
| Meu Perfil | sim | sim | sim |
| Solicitações | fora do menu até haver backend | | |
