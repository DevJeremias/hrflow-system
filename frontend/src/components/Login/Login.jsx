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
      // bate na porta do seu backend
      // TODO: se a sua rota no backend for diferente, ajuste a URL abaixo
      const resposta = await fetch('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, senha })
      });

      const dados = await resposta.json();

      if (!resposta.ok) {
        throw new Error(dados.mensagem || 'E-mail ou senha incorretos.');
      }

      // deu bom! salva o token no cofre
      localStorage.setItem('token', dados.token);

      // manda o usuário direto pra tela de colaboradores
      navigate('/admin/colaboradores');

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
        <p>Insira suas credenciais para continuar.</p>

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