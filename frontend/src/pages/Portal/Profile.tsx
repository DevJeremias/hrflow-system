import React, { useState } from 'react';
import { User as UserIcon, Lock, Briefcase } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import ProfileDataTab from '../../components/Portal/ProfileDataTab';
import ProfileContractTab from '../../components/Portal/ProfileContractTab';
import ProfileSecurityTab from '../../components/Portal/ProfileSecurityTab';
import type { DadosEditaveis } from '../../services/userService';
import { useMeuPerfil } from '../../queries/perfil';
import ErrorAlert from '../../components/ErrorAlert';
import { mensagemDeErro } from '../../utils/erros';

const Profile: React.FC = () => {
  const { updateUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'dados' | 'profissional' | 'seguranca'>('dados');

  const { data: perfil, error, isPending, refetch } = useMeuPerfil();
  const loading = isPending;
  const loadError = error ? mensagemDeErro(error, 'Erro ao carregar o perfil') : null;

  // O cache do perfil já foi invalidado pela mutação; aqui só a identidade da sessão acompanha.
  const handleUpdatePerfil = (novosDados: DadosEditaveis) => {
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

  if (loadError || !perfil) {
    return (
      <div className="max-w-4xl mx-auto">
        <ErrorAlert message={loadError ?? 'Perfil indisponível.'} onRetry={() => { refetch(); }} />
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
        {perfil.vinculado && (
          <button 
            onClick={() => setActiveTab('profissional')} 
            className={`flex items-center gap-2 md:gap-3 px-6 md:px-8 py-3 rounded-xl text-sm font-black transition-all whitespace-nowrap ${activeTab === 'profissional' ? 'bg-white text-primary shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Briefcase size={18} /> Vínculo e Contrato
          </button>
        )}
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
          <ProfileDataTab perfil={perfil} onUpdate={handleUpdatePerfil} />
        )}
        
        {activeTab === 'profissional' && perfil.vinculado && (
          <ProfileContractTab perfil={perfil} />
        )}
        
        {activeTab === 'seguranca' && (
          <ProfileSecurityTab />
        )}
      </main>

    </div>
  );
};

export default Profile;