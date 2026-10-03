import React, { useState } from 'react';
import { User as UserIcon, Lock, Briefcase } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import ProfileDataTab from '../../components/Portal/ProfileDataTab';
import ProfileContractTab from '../../components/Portal/ProfileContractTab';
import ProfileSecurityTab from '../../components/Portal/ProfileSecurityTab';
import type { DadosEditaveis } from '../../services/userService';
import { useMeuPerfil } from '../../queries/perfil';
import ErrorAlert from '../../components/ErrorAlert';
import Card from '../../components/ui/Card';
import PageHeader from '../../components/ui/PageHeader';
import Spinner from '../../components/ui/Spinner';
import Tabs, { TabPanel, type TabItem } from '../../components/ui/Tabs';
import { usePageTitle } from '../../hooks/usePageTitle';
import { mensagemDeErro } from '../../utils/erros';

type Aba = 'dados' | 'profissional' | 'seguranca';

const Profile: React.FC = () => {
  usePageTitle('Meus dados');
  const { updateUser } = useAuth();
  const [activeTab, setActiveTab] = useState<Aba>('dados');

  const { data: perfil, error, isPending, refetch } = useMeuPerfil();
  const loading = isPending;
  const loadError = error ? mensagemDeErro(error, 'Erro ao carregar o perfil') : null;

  // O cache do perfil já foi invalidado pela mutação; aqui só a identidade da sessão acompanha.
  const handleUpdatePerfil = (novosDados: DadosEditaveis) => {
    updateUser({ nome: novosDados.nome, avatar: novosDados.avatar || null });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-ink-muted">
        <Spinner size="lg" rotulo="Carregando perfil..." />
        <p className="font-semibold" aria-hidden="true">Carregando perfil...</p>
      </div>
    );
  }

  if (loadError || !perfil) {
    return (
      <div className="mx-auto max-w-4xl">
        <ErrorAlert message={loadError ?? 'Perfil indisponível.'} onRetry={() => { refetch(); }} />
      </div>
    );
  }

  const abas: TabItem<Aba>[] = [
    { id: 'dados', label: 'Meus Dados', icon: <UserIcon size={18} /> },
    ...(perfil.vinculado ? [{ id: 'profissional' as const, label: 'Vínculo e Contrato', icon: <Briefcase size={18} /> }] : []),
    { id: 'seguranca', label: 'Segurança', icon: <Lock size={18} /> },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6 animate-in fade-in duration-500">
      <PageHeader title="Configurações da Conta" description="Gerencie as suas informações pessoais, profissionais e de segurança." />

      <Tabs tabs={abas} value={activeTab} onChange={setActiveTab} label="Seções da conta" idPrefix="perfil" variant="pill" />

      <Card as="section" padding="lg">
        <TabPanel idPrefix="perfil" id={activeTab}>
          {activeTab === 'dados' && <ProfileDataTab perfil={perfil} onUpdate={handleUpdatePerfil} />}
          {activeTab === 'profissional' && perfil.vinculado && <ProfileContractTab perfil={perfil} />}
          {activeTab === 'seguranca' && <ProfileSecurityTab />}
        </TabPanel>
      </Card>
    </div>
  );
};

export default Profile;
