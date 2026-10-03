import React, { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { userService } from '../../services/userService';
import { useAuth } from '../../contexts/AuthContext';
import { HttpError } from '../../services/httpClient';
import { mensagemDeErro } from '../../utils/erros';
import { mensagemDeLimite } from '../../utils/espera';

// A troca de senha derruba a sessão no servidor; o aviso explica a volta ao login.
const AVISO_SENHA_ALTERADA = 'Senha alterada. Entre novamente.';

const ProfileSecurityTab: React.FC = () => {
  const [senhas, setSenhas] = useState({ atual: '', nova: '', confirmacao: '' });
  const [status, setStatus] = useState({ loading: false, erro: '' });
  const { logout } = useAuth();

  const handleTrocarSenha = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus({ loading: true, erro: '' });
    if (senhas.nova !== senhas.confirmacao) return setStatus({ loading: false, erro: 'As senhas não coincidem.' });
    
    try {
      await userService.changeMyPassword(senhas.atual, senhas.nova);
    } catch (error) {
      const mensagem = mensagemDeErro(error, 'Erro ao alterar senha');
      const erro = error instanceof HttpError && error.status === 429 ? mensagemDeLimite(error.data, mensagem) : mensagem;
      return setStatus({ loading: false, erro });
    }
    await logout(AVISO_SENHA_ALTERADA);
  };

  return (
    <div className="max-w-2xl animate-in fade-in duration-300">
      <h2 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-2">
        <ShieldCheck className="text-emerald-500"/> Alteração de Senha
      </h2>
      
      {status.erro && <div className="p-4 bg-red-50 text-red-600 rounded-2xl font-bold text-sm mb-6">{status.erro}</div>}
      
      <form onSubmit={handleTrocarSenha} className="space-y-6">
        <input required type="password" placeholder="Senha Atual" value={senhas.atual} onChange={e => setSenhas({...senhas, atual: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:border-indigo-600" />
        <input required type="password" placeholder="Nova Senha" value={senhas.nova} onChange={e => setSenhas({...senhas, nova: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:border-indigo-600" />
        <input required type="password" placeholder="Confirmar Nova Senha" value={senhas.confirmacao} onChange={e => setSenhas({...senhas, confirmacao: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:border-indigo-600" />
        <button type="submit" disabled={status.loading} className="px-8 py-4 bg-slate-900 hover:bg-primary text-white font-black rounded-2xl shadow-xl transition-all active:scale-95">
          Atualizar Senha
        </button>
      </form>
    </div>
  );
};

export default ProfileSecurityTab;