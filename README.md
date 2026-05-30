
# 🚀 HRFlow System - Plataforma SaaS de Gestão de RH

![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)
![Express.js](https://img.shields.io/badge/Express.js-404D59?style=for-the-badge)
![MySQL](https://img.shields.io/badge/MySQL-005C84?style=for-the-badge&logo=mysql&logoColor=white)
![JWT](https://img.shields.io/badge/JWT-black?style=for-the-badge&logo=JSON%20web%20tokens)

O **HRFlow** é um sistema completo de Gestão de Recursos Humanos (HRMS) e Departamento Pessoal, construído com arquitetura **Multi-Tenant (Múltiplos Inquilinos)**. O sistema permite que diferentes empresas se cadastrem e gerenciem seus colaboradores em um ambiente de dados 100% isolado e seguro.

---

## ✨ Principais Funcionalidades

### 🔐 Arquitetura de Segurança & SaaS
* **Multi-Tenancy (Isolamento de Dados):** O banco de dados foi projetado para abrigar múltiplas empresas (`empresa_id`). Um cliente jamais tem acesso aos dados de outro.
* **Autenticação JWT:** Login seguro com tokens de acesso contendo payload de identificação e perfil.
* **Role-Based Access Control (RBAC):** Middleware de segurança no Node.js que bloqueia rotas com base no perfil do usuário (`Administrador`, `RH`, `Colaborador`).
* **Automação de Setup:** Triggers no banco de dados que injetam departamentos e cargos iniciais automaticamente assim que uma nova empresa se registra.

### 👥 Gestão de Colaboradores
* **CRUD Completo:** Listagem, cadastro, edição e exclusão (com validação de dependências) de funcionários.
* **Formulário Inteligente:** Separação de dados em abas (Pessoais, Profissionais, Bancários) com validação em tempo real.
* **Integração Dinâmica:** Buscas em tempo real de Cargos e Departamentos direto do Banco de Dados para alimentar o Front-end.

### 📊 Dashboard Analítico
* Visão geral com contagem de colaboradores ativos sincronizada com a API em tempo real.
* Componentes visuais para Gestão de Férias, Solicitações Pendentes e Aniversariantes.

---

## 🛠️ Tecnologias Utilizadas

### Front-end
* **React.js** (Vite)
* **React Router Dom v6** (Configuração de rotas e proteção de rotas privadas)
* **Lucide React** (Ícones)
* **CSS3 Vanilla** (Arquitetura CSS Modular)

### Back-end
* **Node.js** com **Express**
* **MySQL 2** (Driver Promise-based)
* **Bcrypt.js** (Criptografia de senhas)
* **JSON Web Token (JWT)** (Autenticação)

---

## ⚙️ Como Executar o Projeto Localmente

### Pré-requisitos
* Node.js (v18 ou superior) instalado.
* MySQL Server rodando na máquina.

### 1. Clonando o Repositório
```bash
git clone [https://github.com/seu-usuario/hrflow-system.git](https://github.com/seu-usuario/hrflow-system.git)
cd hrflow-system
```

### 2. Configurando o Banco de Dados
Na pasta `backend`, você encontrará o arquivo `database.sql`. Execute o conteúdo deste arquivo no seu MySQL (via MySQL Workbench, DBeaver ou terminal) para criar as tabelas e as triggers do sistema Multi-Tenant.

### 3. Configurando o Back-end
```bash
# Entre na pasta do backend
cd backend

# Instale as dependências
npm install

# Crie um arquivo .env na raiz do backend com as seguintes variáveis:
PORT=3000
DB_HOST=localhost
DB_USER=seu_usuario_mysql
DB_PASS=sua_senha_mysql
DB_NAME=hrflow_db
JWT_SECRET=uma_chave_secreta_muito_forte_aqui

# Inicie o servidor
node server.js
```

### 4. Configurando o Front-end
```bash
# Abra um novo terminal, volte para a raiz e entre na pasta do frontend
cd frontend

# Instale as dependências
npm install

# Inicie o servidor de desenvolvimento
npm run dev
```

O Front-end estará rodando em `http://localhost:5173` e o Back-end em `http://localhost:3000`.

---

## 🛣️ Rotas Principais da API

| Método | Rota | Descrição | Proteção |
|---|---|---|---|
| `POST` | `/api/auth/registrar` | Cria Empresa + Conta do Gestor + Setup Inicial | Pública |
| `POST` | `/api/auth/login` | Autentica e retorna o Token JWT | Pública |
| `GET` | `/api/funcionarios` | Lista funcionários isolados pela empresa logada | Autenticado |
| `POST` | `/api/funcionarios` | Cadastra novo funcionário | Autenticado (Admin/RH) |
| `DELETE`| `/api/funcionarios/:id` | Exclui um funcionário | Autenticado (Admin/RH) |

---

## 👨‍💻 Próximos Passos (Roadmap)
- [ ] Módulo completo de Folha de Pagamento.
- [ ] Upload de documentos em nuvem (AWS S3 / Firebase).
- [ ] Sistema de controle de ponto e batida web.
```
