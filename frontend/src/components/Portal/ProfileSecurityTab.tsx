import React, { useState } from 'react';
import { ShieldCheck } from 'lucide-react';

interface Props {
  getToken: () => string | null;
}

const ProfileSecurityTab: React.FC<Props> = ({ getToken }) => {
  const [senhas, setSenhas] = useState({ atual: '', nova: '', confirmacao: '' });
  const [status, setStatus] = useState({ loading: false, erro: '', sucesso: '' });

  const handleTrocarSenha = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus({ loading: true, erro: '', sucesso: '' });
    if (senhas.nova !== senhas.confirmacao) return setStatus({ loading: false, erro: 'As senhas não coincidem.', sucesso: '' });
    
    try {
      const res = await fetch('http://localhost:3000/api/perfil/alterar-senha', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
        body: JSON.stringify({ senhaAtual: senhas.atual, novaSenha: senhas.nova })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.erro || 'Erro ao alterar senha');
      
      setStatus({ loading: false, erro: '', sucesso: data.mensagem || 'Senha atualizada com sucesso!' });
      setSenhas({ atual: '', nova: '', confirmacao: '' });
      setTimeout(() => setStatus(s => ({ ...s, sucesso: '' })), 4000);
    } catch (error: any) {
      setStatus({ loading: false, erro: error.message, sucesso: '' });
    }
  };

  return (
    <div className="max-w-2xl animate-in fade-in duration-300">
      <h2 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-2">
        <ShieldCheck className="text-emerald-500"/> Alteração de Senha
      </h2>
      
      {status.erro && <div className="p-4 bg-red-50 text-red-600 rounded-2xl font-bold text-sm mb-6">{status.erro}</div>}
      {status.sucesso && <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl font-bold text-sm mb-6">{status.sucesso}</div>}
      
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