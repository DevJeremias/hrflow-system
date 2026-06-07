import React, { useState, useEffect, useRef } from 'react';
import { User, Lock, Mail, Phone, Building2, Briefcase, ShieldCheck, Edit2, Save, X, Camera } from 'lucide-react';

interface PerfilData {
  nome: string;
  email: string;
  telefone?: string;
  cpf?: string;
  cargo?: string;
  departamento?: string;
  avatar?: string;
  isAdmin: boolean;
}

const Profile: React.FC = () => {
  const [perfil, setPerfil] = useState<PerfilData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dados' | 'seguranca'>('dados');
  
  // Estados para Edição de Dados
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ email: '', telefone: '', avatar: '' });
  const [statusDados, setStatusDados] = useState({ loading: false, erro: '', sucesso: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Estados para a troca de senha
  const [senhas, setSenhas] = useState({ atual: '', nova: '', confirmacao: '' });
  const [statusSenha, setStatusSenha] = useState({ loading: false, erro: '', sucesso: '' });

  const getToken = () => localStorage.getItem('token');

  const carregarPerfil = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/perfil/meus-dados', {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPerfil(data);
        setEditForm({ email: data.email, telefone: data.telefone || '', avatar: data.avatar || '' });
      }
    } catch (error) {
      console.error("Erro ao carregar perfil:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarPerfil();
  }, []);

  // Conversão de Imagem para Base64
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { // Limite de 2MB
        alert("A imagem não pode ter mais de 2MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditForm(prev => ({ ...prev, avatar: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSalvarDados = async () => {
    setStatusDados({ loading: true, erro: '', sucesso: '' });
    try {
      const res = await fetch('http://localhost:3000/api/perfil/meus-dados', {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}` 
        },
        body: JSON.stringify({
          email: editForm.email,
          telefone: editForm.telefone,
          avatar: editForm.avatar
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.erro || 'Erro ao atualizar dados');

      setStatusDados({ loading: false, erro: '', sucesso: data.mensagem });
      setIsEditing(false);
      await carregarPerfil(); // Recarrega os dados visuais
      
      setTimeout(() => setStatusDados({ loading: false, erro: '', sucesso: '' }), 3000);
    } catch (error: any) {
      setStatusDados({ loading: false, erro: error.message, sucesso: '' });
    }
  };

  const handleTrocarSenha = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusSenha({ loading: true, erro: '', sucesso: '' });

    if (senhas.nova !== senhas.confirmacao) {
      setStatusSenha({ loading: false, erro: 'A nova senha e a confirmação não coincidem.', sucesso: '' });
      return;
    }

    try {
      const res = await fetch('http://localhost:3000/api/perfil/alterar-senha', {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}` 
        },
        body: JSON.stringify({ senhaAtual: senhas.atual, novaSenha: senhas.nova })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.erro || 'Erro ao alterar senha');

      setStatusSenha({ loading: false, erro: '', sucesso: data.mensagem });
      setSenhas({ atual: '', nova: '', confirmacao: '' });
    } catch (error: any) {
      setStatusSenha({ loading: false, erro: error.message, sucesso: '' });
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-4">
        <div className="w-10 h-10 border-4 border-slate-200 border-t-primary rounded-full animate-spin"></div>
        <p className="font-bold">A carregar os seus dados...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-4xl mx-auto">
      
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Configurações da Conta</h1>
          <p className="text-slate-500 font-medium mt-1">Gerencie as suas informações pessoais e de segurança.</p>
        </div>
        
        {activeTab === 'dados' && !isEditing && (
          <button 
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 px-5 py-2.5 rounded-xl font-bold transition-all"
          >
            <Edit2 size={16} /> Editar Perfil
          </button>
        )}
      </div>

      <div className="inline-flex bg-slate-100/80 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200/50">
        <button 
          onClick={() => { setActiveTab('dados'); setIsEditing(false); }}
          className={`flex items-center gap-3 px-8 py-3 rounded-xl text-sm font-black transition-all ${activeTab === 'dados' ? 'bg-white text-primary shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <User size={18} /> Meus Dados
        </button>
        <button 
          onClick={() => setActiveTab('seguranca')}
          className={`flex items-center gap-3 px-8 py-3 rounded-xl text-sm font-black transition-all ${activeTab === 'seguranca' ? 'bg-white text-primary shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <Lock size={18} /> Segurança
        </button>
      </div>

      <main className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden relative">
        
        {activeTab === 'dados' ? (
          <div className="p-8 md:p-12 space-y-8">
            
            {statusDados.erro && <div className="p-4 bg-red-50 text-red-600 rounded-2xl font-bold text-sm border border-red-100">{statusDados.erro}</div>}
            {statusDados.sucesso && <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl font-bold text-sm border border-emerald-100">{statusDados.sucesso}</div>}

            <div className="flex items-center gap-6 pb-8 border-b border-slate-100">
              <div className="relative group">
                <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-indigo-500 to-primary flex items-center justify-center text-white text-3xl font-black shadow-lg shadow-indigo-500/20 overflow-hidden">
                  {isEditing && editForm.avatar ? (
                    <img src={editForm.avatar} alt="Avatar" className="w-full h-full object-cover" />
                  ) : perfil?.avatar ? (
                    <img src={perfil.avatar} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    perfil?.nome ? perfil.nome.charAt(0).toUpperCase() : 'U'
                  )}
                </div>
                
                {isEditing && (
                  <>
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute bottom-0 right-0 p-2 bg-slate-900 text-white rounded-full shadow-lg hover:bg-primary transition-colors cursor-pointer"
                    >
                      <Camera size={14} />
                    </button>
                    <input 
                      type="file" 
                      accept="image/*" 
                      ref={fileInputRef} 
                      className="hidden" 
                      onChange={handleImageUpload} 
                    />
                  </>
                )}
              </div>
              
              <div>
                <h2 className="text-2xl font-black text-slate-900">{perfil?.nome}</h2>
                <div className="flex items-center gap-2 text-slate-500 font-medium mt-1">
                  <Briefcase size={16} /> {perfil?.cargo || 'Cargo não definido'}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Mail size={14}/> E-mail Corporativo
                </label>
                {isEditing ? (
                  <input 
                    type="email" 
                    value={editForm.email} 
                    onChange={e => setEditForm({...editForm, email: e.target.value})}
                    className="w-full p-4 bg-slate-50 border border-indigo-200 rounded-2xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                ) : (
                  <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700">{perfil?.email}</div>
                )}
              </div>
              
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Phone size={14}/> Telefone
                </label>
                {isEditing ? (
                  <input 
                    type="text" 
                    value={editForm.telefone} 
                    onChange={e => setEditForm({...editForm, telefone: e.target.value})}
                    placeholder="(00) 00000-0000"
                    className="w-full p-4 bg-slate-50 border border-indigo-200 rounded-2xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                ) : (
                  <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700">{perfil?.telefone || 'Não informado'}</div>
                )}
              </div>

              {!perfil?.isAdmin && (
                <>
                  <div className="space-y-1.5 opacity-70">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <Building2 size={14}/> Departamento <Lock size={10} className="text-slate-300"/>
                    </label>
                    <div className="p-4 bg-slate-100/50 border border-slate-100 rounded-2xl font-bold text-slate-500 cursor-not-allowed">
                      {perfil?.departamento || 'Não definido'}
                    </div>
                  </div>
                  <div className="space-y-1.5 opacity-70">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <User size={14}/> CPF <Lock size={10} className="text-slate-300"/>
                    </label>
                    <div className="p-4 bg-slate-100/50 border border-slate-100 rounded-2xl font-bold text-slate-500 cursor-not-allowed">
                      {perfil?.cpf || 'Não informado'}
                    </div>
                  </div>
                </>
              )}
            </div>

            {isEditing && (
              <div className="flex gap-4 pt-6 border-t border-slate-100">
                <button 
                  onClick={() => setIsEditing(false)}
                  className="flex-1 py-4 font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  <X size={18} /> Cancelar
                </button>
                <button 
                  onClick={handleSalvarDados}
                  disabled={statusDados.loading}
                  className="flex-1 py-4 bg-slate-900 hover:bg-primary text-white font-black rounded-xl transition-all flex items-center justify-center gap-2 shadow-xl active:scale-95 disabled:opacity-50"
                >
                  {statusDados.loading ? 'A Guardar...' : <><Save size={18} /> Guardar Alterações</>}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="p-8 md:p-12 max-w-2xl">
            <div className="mb-8">
              <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                <ShieldCheck className="text-emerald-500"/> Alteração de Senha
              </h2>
              <p className="text-sm font-medium text-slate-500 mt-2">
                Crie uma nova senha forte para manter a integridade do seu acesso à plataforma.
              </p>
            </div>

            {statusSenha.erro && <div className="p-4 bg-red-50 text-red-600 rounded-2xl font-bold text-sm mb-6 border border-red-100">{statusSenha.erro}</div>}
            {statusSenha.sucesso && <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl font-bold text-sm mb-6 border border-emerald-100">{statusSenha.sucesso}</div>}

            <form onSubmit={handleTrocarSenha} className="space-y-6">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Senha Atual *</label>
                <input required type="password" value={senhas.atual} onChange={e => setSenhas({...senhas, atual: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:border-indigo-600 focus:bg-white outline-none font-bold text-slate-900 transition-all" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nova Senha *</label>
                  <input required type="password" value={senhas.nova} onChange={e => setSenhas({...senhas, nova: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:border-indigo-600 focus:bg-white outline-none font-bold text-slate-900 transition-all" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Confirmar Nova Senha *</label>
                  <input required type="password" value={senhas.confirmacao} onChange={e => setSenhas({...senhas, confirmacao: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:border-indigo-600 focus:bg-white outline-none font-bold text-slate-900 transition-all" />
                </div>
              </div>
              <div className="pt-4">
                <button type="submit" disabled={statusSenha.loading} className="px-8 py-4 bg-slate-900 hover:bg-primary text-white font-black rounded-2xl transition-all shadow-xl active:scale-95 disabled:opacity-50">
                  {statusSenha.loading ? 'Atualizando...' : 'Atualizar Senha'}
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
};

export default Profile;