import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import './Register.css';

const Register = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    nomeEmpresa: '',
    nomeAdmin: '',
    email: '',
    senha: ''
  });
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErro('');
    setLoading(true);

    try {
      const resposta = await fetch('http://localhost:3000/api/auth/registrar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      const dados = await resposta.json();

      if (!resposta.ok) {
        throw new Error(dados.erro || 'Erro ao criar conta');
      }

      setSucesso(true);
      // Aguarda 2 segundos para o usuário ler a mensagem de sucesso e joga pro login
      setTimeout(() => {
        navigate('/login');
      }, 2000);

    } catch (err) {
      setErro(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-container">
      <div className="register-card">
        <div className="register-header">
          <h2>Crie sua conta no Sistema RH</h2>
          <p>Comece a transformar a gestão de pessoas da sua empresa hoje mesmo.</p>
        </div>

        {erro && <div className="alert-error">{erro}</div>}
        {sucesso && <div className="alert-success">Conta criada com sucesso! Redirecionando...</div>}

        <form onSubmit={handleSubmit} className="register-form">
          <div className="form-group">
            <label>Nome da Empresa</label>
            <input 
              type="text" 
              name="nomeEmpresa" 
              value={formData.nomeEmpresa} 
              onChange={handleChange} 
              placeholder="Ex: Tech Solutions Ltda"
              required 
            />
          </div>

          <div className="form-group">
            <label>Seu Nome (Gestor/Admin)</label>
            <input 
              type="text" 
              name="nomeAdmin" 
              value={formData.nomeAdmin} 
              onChange={handleChange} 
              placeholder="Ex: João da Silva"
              required 
            />
          </div>

          <div className="form-group">
            <label>E-mail Corporativo</label>
            <input 
              type="email" 
              name="email" 
              value={formData.email} 
              onChange={handleChange} 
              placeholder="joao@techsolutions.com"
              required 
            />
          </div>

          <div className="form-group">
            <label>Senha de Acesso</label>
            <input 
              type="password" 
              name="senha" 
              value={formData.senha} 
              onChange={handleChange} 
              placeholder="Crie uma senha forte"
              required 
            />
          </div>

          <button type="submit" className="btn-register" disabled={loading || sucesso}>
            {loading ? 'Criando conta...' : 'Criar minha conta'}
          </button>
        </form>

        <div className="register-footer">
          <p>Já tem uma conta? <Link to="/login">Faça login aqui</Link></p>
        </div>
      </div>
    </div>
  );
};

export default Register;