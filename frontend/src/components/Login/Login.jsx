import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Login.css';

export default function Login() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const fazerLogin = async (e) => {
    e.preventDefault();
    setErro(''); // limpa mensagens de erro antigas
    setLoading(true);

    try {
      // bate na porta do teu backend
      const resposta = await fetch('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, senha })
      });

      const dados = await resposta.json();

      if (!resposta.ok) {
        throw new Error(dados.mensagem || dados.erro || 'E-mail ou senha incorretos.');
      }

      // deu bom! salva o token no cofre
      localStorage.setItem('token', dados.token);

      // Descodifica o Token JWT para descobrir o perfil do utilizador
      const base64Url = dados.token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(window.atob(base64));

      // Guarda os dados cruciais para o Relógio de Ponto e para o Dashboard funcionarem
      localStorage.setItem('nomeUsuario', payload.nome || 'Utilizador');
      localStorage.setItem('funcionarioId', payload.id);
      localStorage.setItem('perfil', payload.perfil);

      // O "Polícia de Trânsito" do sistema:
      // Se for colaborador, vai para a tela de bater o ponto. Senão, vai para o painel de RH.
      if (payload.perfil === 'Colaborador') {
        navigate('/meu-painel');
      } else {
        navigate('/admin');
      }

    } catch (err) {
      setErro(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h2>Acesso ao Sistema</h2>
        <p>Insira as suas credenciais para continuar.</p>

        {erro && <div className="erro-msg">{erro}</div>}

        <form onSubmit={fazerLogin}>
          <div className="input-group">
            <label>E-mail</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@hrflow.com"
              required 
            />
          </div>

          <div className="input-group">
            <label>Senha</label>
            <input 
              type="password" 
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="******"
              required 
            />
          </div>

          <button type="submit" className="btn-login" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}