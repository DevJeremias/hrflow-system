# hrflow-system

# 🚀 HRFlow - Sistema de Gerenciamento de RH

Este é o **Back-end** do projeto **HRFlow**, desenvolvido para centralizar a gestão de funcionários, cargos e departamentos de forma **segura, escalável e eficiente**.

---

## 🛠️ Tecnologias Utilizadas

- **Node.js** com **Express**
- **MySQL** para persistência de dados
- **JWT (JSON Web Token)** para autenticação
- **Bcryptjs** para criptografia de senhas

---

## 📋 Pré-requisitos para a Equipe

Antes de rodar o projeto, certifique-se de ter instalado:

- [Node.js](https://nodejs.org/)
- MySQL Server

---

## 🗄️ Configuração do Banco de Dados

1. Crie um banco de dados chamado:

```sql
CREATE DATABASE hrflow_db;
```

2. Execute os scripts SQL localizados na pasta `/database`
   *(ou solicite o dump atualizado ao líder do projeto).*

---

## ⚙️ Configuração do Arquivo `.env`

Crie um arquivo `.env` na raiz da pasta `backend` com as seguintes variáveis:

```env
PORT=3000
DB_HOST=localhost
DB_USER=seu_usuario
DB_PASS=sua_senha
DB_NAME=hrflow_db
JWT_SECRET=projeto_hrflow_2026
```

---

## 🚀 Como Rodar o Projeto

```bash
# Clone o repositório
git clone https://github.com/seu-usuario/hrflow.git

# Acesse a pasta do backend
cd backend

# Instale as dependências
npm install

# Inicie o servidor
node server.js
```

O servidor será iniciado em:
```
http://localhost:3000
```

---

## 🔐 Guia da API (Endpoints)

### 🔑 Autenticação (Público)

- `POST /api/auth/registrar`  
  Cria um novo usuário (**Admin / RH / Colaborador**)

- `POST /api/auth/login`  
  Autentica o usuário e retorna o **Token JWT**

---

### 👥 Funcionários (Protegido - Requer Token)

- `GET /api/funcionarios`  
  Retorna a lista de funcionários com cargo e departamento

- `POST /api/funcionarios`  
  Cadastra um novo funcionário

---

## 💡 Instruções para o Front-end (React + Axios)

Para acessar rotas protegidas, envie o **Token JWT** no cabeçalho das requisições usando o padrão **Bearer Token**.

### Exemplo com Axios:

```javascript
import axios from 'axios';

const token = localStorage.getItem('token');

const api = axios.create({
  baseURL: 'http://localhost:3000/api',
  headers: {
    Authorization: `Bearer ${token}`
  }
});

export default api;
```

> ⚠️ **Atenção:**  
> Caso o token não seja enviado ou esteja inválido, a API retornará:
> - `401 Unauthorized`
> - `400 Bad Request`

---

## 📌 Observações Finais

- Este projeto segue boas práticas de autenticação e organização de código.
- Ideal para uso acadêmico, portfólio profissional e projetos colaborativos.
- Documentação de **Editar** e **Excluir** pode ser adicionada para completar o CRUD.

---

🚀 **Projeto pronto para evoluir!**
