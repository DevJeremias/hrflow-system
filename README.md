


# HRFlow 🚀

<div align="center">
  <img alt="React" src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" />
  <img alt="Node.js" src="https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white" />
  <img alt="MySQL" src="https://img.shields.io/badge/MySQL-00000F?style=for-the-badge&logo=mysql&logoColor=white" />
  <br/>
  <b>Status:</b> Em Desenvolvimento (Fase 3 Concluída) 🚧
</div>

<br/>

O **HRFlow** é um Sistema Integrado de Gestão de Recursos Humanos desenhado para modernizar, centralizar e automatizar o ecossistema financeiro e administrativo de empresas, acabando com a dependência de processos manuais e planilhas desconexas.

## 🎯 A Dor e a Solução

**O Problema:** 
Departamentos de Recursos Humanos tradicionais sofrem com a fragmentação de informações. Dados de colaboradores perdem-se em dezenas de ficheiros, cálculos de folha de pagamento (como retenções de INSS e encargos) são feitos manualmente – o que gera margem para erros legais e financeiros – e os funcionários não têm autonomia para aceder aos seus próprios dados de forma centralizada.

**A Solução HRFlow:** 
Construímos uma plataforma web que unifica a jornada do colaborador e da empresa. O sistema gere desde a estrutura hierárquica (departamentos e cargos) até ao processamento automático da folha de pagamento através de um motor matemático no back-end. Além disso, disponibiliza um **Portal do Colaborador**, onde cada utilizador tem acesso seguro e independente aos seus próprios holerites e informações.

## ⚙️ Arquitetura e Decisões Técnicas

Para garantir escalabilidade e segurança, adotamos uma arquitetura separada (Client-Server):

*   **Front-end (SPA):** Desenvolvido em **React** com **TypeScript** e **Vite**, garantindo uma tipagem estática rigorosa (evitando erros de *runtime*) e um build extremamente rápido. A interface foi construída com **TailwindCSS** para uma estética limpa, responsiva e moderna.
*   **Back-end (API REST):** Construído em **Node.js** com **Express**. Toda a lógica pesada e de negócios (como o cálculo de impostos e ordenados) foi isolada no servidor para evitar manipulações no lado do cliente.
*   **Segurança:** A autenticação e a proteção das rotas são geridas via **JWT (JSON Web Tokens)**. O back-end extrai a identidade do utilizador diretamente do token, impedindo que um funcionário aceda ao holerite de outro.
*   **Base de Dados:** **MySQL** relacional. Estruturámos as tabelas de forma normalizada para garantir a integridade dos dados e implementámos proteções contra entradas vazias (ex: tratamento de datas `NULL` via código) para manter a base de dados blindada contra crashes.

## ✨ Funcionalidades Principais

*   **Gestão Estrutural:** Criação e controlo de Departamentos e Cargos (níveis hierárquicos, salários base e gestores).
*   **Core RH (Colaboradores):** CRUD completo de funcionários, com gestão segmentada de dados (Informações Pessoais, Contratuais e Financeiras).
*   **Motor de Folha de Pagamento:** Processamento em lote de todos os salários ativos, aplicando automaticamente as tabelas de dedução de impostos (INSS) e calculando o Custo Bruto, Líquido e Encargos Patronais.
*   **Portal do Colaborador:** Acesso restrito para funcionários visualizarem e fazerem o download dos seus holerites em tempo real.

## 📂 Estrutura de Diretórios

```text
hrflow-system/
├── backend/
│   ├── config/            # Conexões de banco de dados (db.js)
│   ├── controllers/       # Lógica de negócio (folhaController, funcionarioController)
│   ├── middlewares/       # Proteções JWT e validação de perfis (Admin/Colaborador)
│   ├── routes/            # Endpoints da API REST
│   └── server.js          # Ponto de entrada do Node.js
└── frontend/
    ├── src/
    │   ├── components/    # Componentes React (Admin, Portal, UI)
    │   ├── services/      # Comunicação com a API (fetch)
    │   ├── AuthContext.tsx# Gestão de estado global de Autenticação
    │   └── App.tsx        # Rotas do Front-end (React Router)
    ├── vite.config.ts
    └── package.json

```

## 🚀 Próximos Passos (Roadmap)

* [x] **Fase 1:** Autenticação e Perfis de Acesso.
* [x] **Fase 2:** Gestão de Colaboradores e Estrutura Organizacional.
* [x] **Fase 3:** Motor Financeiro e Folha de Pagamento Automatizada.
* [ ] **Fase 4:** Relógio de Ponto Eletrónico (Registo de Entradas/Saídas e Banco de Horas).
* [ ] **Fase 5:** Geração de relatórios em formato PDF e Dashboard Analítico.

---

## 🛠️ Guia de Configuração e Instalação (Ambiente Local)

Siga os passos abaixo para preparar o ambiente de desenvolvimento sem margem para erros.

### Pré-requisitos

* [Node.js](https://nodejs.org/) (v18 ou superior)
* [MySQL](https://www.mysql.com/) (v8 ou superior) instalado e a rodar na máquina local.

### Passo 1: Preparação da Base de Dados (Crucial)

Abra o seu gestor de base de dados (ex: DBeaver, MySQL Workbench) e execute o script SQL abaixo para criar o esquema relacional completo com os tipos de dados exatos suportados pela API:

```sql
CREATE DATABASE IF NOT EXISTS hrflow_db;
USE hrflow_db;

-- 1. Estrutura Organizacional
CREATE TABLE IF NOT EXISTS departamentos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    sigla VARCHAR(10) NOT NULL,
    descricao TEXT,
    gestor VARCHAR(100),
    empresa_id INT DEFAULT 1
);

CREATE TABLE IF NOT EXISTS cargos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    departamento_id INT,
    nivel VARCHAR(50),
    salario_base DECIMAL(10,2),
    empresa_id INT DEFAULT 1,
    FOREIGN KEY (departamento_id) REFERENCES departamentos(id)
);

-- 2. Core de Recursos Humanos
CREATE TABLE IF NOT EXISTS funcionarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    cpf VARCHAR(20),
    email VARCHAR(100) NOT NULL,
    telefone VARCHAR(20),
    data_admissao DATE NULL,
    data_nascimento DATE NULL,
    endereco TEXT NULL,
    banco VARCHAR(100) NULL,
    agencia VARCHAR(20) NULL,
    conta VARCHAR(20) NULL,
    tipo_conta VARCHAR(50) NULL,
    nivel VARCHAR(50) NULL,
    tipo_contrato VARCHAR(50) NULL,
    salario_base DECIMAL(10,2) NULL,
    cargo_id INT NULL,
    departamento_id INT NULL,
    status VARCHAR(20) DEFAULT 'Ativo',
    empresa_id INT DEFAULT 1,
    FOREIGN KEY (cargo_id) REFERENCES cargos(id),
    FOREIGN KEY (departamento_id) REFERENCES departamentos(id)
);

-- 3. Autenticação e Perfis
CREATE TABLE IF NOT EXISTS usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(100) NOT NULL UNIQUE,
    senha VARCHAR(255) NOT NULL,
    perfil VARCHAR(50) NOT NULL,
    empresa_id INT DEFAULT 1,
    funcionario_id INT NULL,
    FOREIGN KEY (funcionario_id) REFERENCES funcionarios(id)
);

```

### Passo 2: Configuração do Back-end

1. Navegue até a pasta do servidor:

```bash
   cd hrflow-system/backend

```

2. Instale as dependências:

```bash
   npm install

```

3. Crie um ficheiro `.env` na raiz da pasta `backend/` seguindo exatamente este formato:

```env
   # Configurações do Servidor
   PORT=3000

   # Conexão com o MySQL
   DB_HOST=localhost
   DB_USER=root
   DB_PASS=sua_senha_do_mysql_aqui
   DB_NAME=hrflow_db

   # Chave de Segurança JWT
   JWT_SECRET=super_secret_hrflow_key_2026

```

4. Inicie o servidor:

```bash
   node server.js
   # Você deverá ver: "🚀 Servidor rodando na porta 3000" e "✅ Banco de Dados: Conexão testada e funcionando!"

```

### Passo 3: Configuração do Front-end

1. Abra um novo terminal e navegue até a pasta cliente:

```bash
   cd hrflow-system/frontend

```

2. Instale as dependências:

```bash
   npm install

```

3. Inicie o ambiente de desenvolvimento do Vite:

```bash
   npm run dev

```

4. Aceda à aplicação através do link gerado no terminal (geralmente `http://localhost:5173`).

---

## 👥 Equipa de Desenvolvimento

Sistema desenvolvido e arquitetado por:

* **Henrique Jeremias** ([@devjeremias](https://www.google.com/search?q=https://github.com/devjeremias))
* **Marcos**
* **Yuri**
* **Thalison**
* **Breno**
* **Caique**
* **Henri**

```
