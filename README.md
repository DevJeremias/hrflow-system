

# 🚀 HRFlow System - Back-end

O **HRFlow** é um sistema de gerenciamento de Recursos Humanos desenvolvido para centralizar a gestão de funcionários, cargos e departamentos, garantindo segurança e controle de acesso hierárquico.

## 🏗️ Arquitetura e Estrutura do Projeto

O projeto foi estruturado utilizando uma adaptação do padrão **MVC (Model-View-Controller)** para APIs RESTful, separando claramente as responsabilidades:

* **Routes (Rotas):** Portas de entrada da API. Direcionam as requisições HTTP para os controladores corretos.
* **Controllers (Controladores):** Contêm as regras de negócio. Processam as requisições, interagem com o banco de dados e formatam as respostas JSON.
* **Middlewares:** Interceptadores de segurança. Validam tokens JWT e verificam permissões de acesso (RBAC) antes de deixar a requisição chegar ao Controller.
* **Database (Modelos/Queries):** Gerenciamento da conexão com o banco de dados MySQL e execução das queries SQL.

### 📂 Estrutura de Pastas
```text
backend/
├── controllers/          # Lógica de negócio (ex: funcionarioController.js)
├── middlewares/          # Filtros de segurança (authMiddleware.js, roleMiddleware.js)
├── routes/               # Definição dos endpoints (funcionarioRoutes.js)
├── database/             # Scripts SQL e configuração de conexão
├── .env.example          # Template das variáveis de ambiente
├── server.js             # Arquivo principal que inicializa a aplicação
└── package.json          # Dependências do projeto

```

## 🛠️ Tecnologias Utilizadas

* **Node.js** com **Express** (Framework web rápido e minimalista)
* **MySQL** (Banco de Dados Relacional)
* **JWT (JSON Web Token)** (Autenticação de usuários)
* **Bcryptjs** (Criptografia de senhas)

## 🔐 Controle de Acesso (RBAC)

O sistema possui três níveis de permissão que restringem o que cada usuário pode fazer na API:

1. **Administrador:** Acesso total ao sistema.
2. **RH:** Pode gerenciar (Criar, Editar, Excluir) funcionários, cargos e departamentos.
3. **Colaborador:** Acesso de leitura (Apenas visualização das listagens).

---

## 🚀 Como Rodar o Projeto Localmente

### 1. Pré-requisitos

* Node.js instalado.
* MySQL Server rodando localmente.

### 2. Configuração do Banco de Dados

Crie um banco de dados chamado `hrflow_db` e execute os scripts SQL disponíveis com a equipe para criar as tabelas (`usuarios`, `funcionarios`, `cargos`, `departamentos`).

### 3. Configuração do Ambiente

Crie um arquivo `.env` na raiz da pasta `backend` seguindo o modelo do `.env.example`:

```env
PORT=3000
DB_HOST=localhost
DB_USER=seu_usuario_mysql
DB_PASS=sua_senha_mysql
DB_NAME=hrflow_db
JWT_SECRET=sua_chave_secreta_aqui

```

### 4. Instalação e Execução

```bash
# Clone o repositório
git clone url-do-seu-repositorio

# Acesse a pasta do backend
cd backend

# Instale as dependências
npm install

# Inicie o servidor
node server.js

```

---

## 📡 Endpoints da API (MVP)

> **⚠️ Atenção:** Para acessar rotas protegidas, envie o Token JWT no cabeçalho da requisição: `Authorization: Bearer <seu_token>`

### 🔑 Autenticação (Público)

| Método | Rota | Descrição |
| --- | --- | --- |
| `POST` | `/api/auth/registrar` | Cria um novo usuário (Admin/RH/Colaborador). |
| `POST` | `/api/auth/login` | Autentica o usuário e retorna o Token JWT. |

### 👥 Funcionários (Protegido)

| Método | Rota | Descrição | Permissão Exigida |
| --- | --- | --- | --- |
| `GET` | `/api/funcionarios` | Lista todos os funcionários. | Qualquer usuário logado |
| `POST` | `/api/funcionarios` | Cadastra um novo funcionário. | Administrador ou RH |
| `PUT` | `/api/funcionarios/:id` | Atualiza os dados de um funcionário. | Administrador ou RH |
| `DELETE` | `/api/funcionarios/:id` | Exclui um funcionário do sistema. | Administrador ou RH |

