import React, { useState, useEffect } from 'react';
import { User as UserIcon, Lock, Briefcase } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import ProfileDataTab from '../../components/Portal/ProfileDataTab';
import ProfileContractTab from '../../components/Portal/ProfileContractTab';
import ProfileSecurityTab from '../../components/Portal/ProfileSecurityTab';
import { userService } from '../../services/userService';

const Profile: React.FC = () => {
  const { updateUser } = useAuth();
  const [perfil, setPerfil] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dados' | 'profissional' | 'seguranca'>('dados');

  const getToken = () => localStorage.getItem('token');

  const carregarPerfil = async () => {
  try {
    const data = await userService.getMyPersonalData();
    setPerfil(data);
    updateUser({ nome: data.nome, avatar: data.avatar || null });
  } catch (error) {
    console.error("Erro ao carregar perfil:", error);
  } finally {
    setLoading(false);
  }
  };

  useEffect(() => {
    carregarPerfil();
  }, []);

  // Atualiza o estado local e global quando a aba de dados salva uma alteração
  const handleUpdatePerfil = (novosDados: any) => {
    setPerfil((prev: any) => ({ ...prev, ...novosDados }));
    updateUser({ nome: novosDados.nome, avatar: novosDados.avatar || null });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-4">
        <div className="w-10 h-10 border-4 border-slate-200 border-t-primary rounded-full animate-spin"></div>
        <p className="font-bold">A carregar perfil...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700 max-w-4xl mx-auto">
      
      {/* CABEÇALHO */}
      <div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Configurações da Conta</h1>
        <p className="text-slate-500 font-medium mt-1">Gerencie as suas informações pessoais, profissionais e de segurança.</p>
      </div>

      {/* NAVEGAÇÃO DE ABAS */}
      <div className="inline-flex bg-slate-100/80 p-1.5 rounded-2xl overflow-x-auto max-w-full custom-scrollbar">
        <button 
          onClick={() => setActiveTab('dados')} 
          className={`flex items-center gap-2 md:gap-3 px-6 md:px-8 py-3 rounded-xl text-sm font-black transition-all whitespace-nowrap ${activeTab === 'dados' ? 'bg-white text-primary shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <UserIcon size={18} /> Meus Dados
        </button>
        <button 
          onClick={() => setActiveTab('profissional')} 
          className={`flex items-center gap-2 md:gap-3 px-6 md:px-8 py-3 rounded-xl text-sm font-black transition-all whitespace-nowrap ${activeTab === 'profissional' ? 'bg-white text-primary shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <Briefcase size={18} /> Vínculo e Contrato
        </button>
        <button 
          onClick={() => setActiveTab('seguranca')} 
          className={`flex items-center gap-2 md:gap-3 px-6 md:px-8 py-3 rounded-xl text-sm font-black transition-all whitespace-nowrap ${activeTab === 'seguranca' ? 'bg-white text-primary shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <Lock size={18} /> Segurança
        </button>
      </div>

      {/* ÁREA DE CONTEÚDO (RENDERIZA O COMPONENTE DA ABA ATIVA) */}
      <main className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden relative p-8 md:p-12">
        {activeTab === 'dados' && (
          <ProfileDataTab perfil={perfil} onUpdate={handleUpdatePerfil} getToken={getToken} />
        )}
        
        {activeTab === 'profissional' && (
          <ProfileContractTab perfil={perfil} />
        )}
        
        {activeTab === 'seguranca' && (
          <ProfileSecurityTab getToken={getToken} />
        )}
      </main>

    </div>
  );
};

export default Profile;