import React, { useState, useEffect } from 'react';
import { userService, UserPersonalData } from '../../../services/userService'; 

const MyProfile: React.FC = () => {
  // Aplicando a tipagem ao estado
  const [profileData, setProfileData] = useState<UserPersonalData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const data = await userService.getMyPersonalData();
        setProfileData(data);
      } catch (error) {
        console.error("Não foi possível carregar os dados do perfil.");
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  // Tipando o parâmetro da data
  const formatarData = (dataString?: string | null): string => {
    if (!dataString) return '-';
    const data = new Date(dataString);
    return new Date(data.getTime() + data.getTimezoneOffset() * 60000).toLocaleDateString('pt-BR');
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-50">
        <p className="text-gray-500 font-medium animate-pulse">A carregar os seus dados...</p>
      </div>
    );
  }

  if (!profileData) {
    return (
      <div className="p-6 bg-red-50 text-red-700 rounded-lg m-6 border border-red-200">
        <p className="font-bold">Erro de Vinculação</p>
        <p>Não foi possível encontrar os dados deste funcionário. Confirme se o seu e-mail de login é exatamente igual ao e-mail registado nos Funcionários.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6 bg-gray-50 min-h-screen">
      
      {/* Cabeçalho de Perfil */}
      <div className="bg-white p-6 rounded-2xl shadow-sm flex flex-col md:flex-row items-center gap-4 border border-gray-200">
        <div className="w-20 h-20 bg-blue-600 rounded-full flex justify-center items-center text-white text-3xl font-bold uppercase shadow-inner">
          {profileData.nome.substring(0, 2)}
        </div>
        <div className="text-center md:text-left">
          <h1 className="text-2xl font-bold text-gray-800">{profileData.nome}</h1>
          <p className="text-gray-500 font-medium">
            {profileData.cargo_nome || 'Cargo não definido'} • {profileData.departamento_nome || 'Sem Departamento'}
          </p>
          <span className={`inline-block mt-2 px-3 py-1 text-xs font-semibold rounded-full ${profileData.status === 'Ativo' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
            Contrato {profileData.status}
          </span>
        </div>
      </div>

      {/* Secção 1: Dados Pessoais */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
        <h2 className="text-lg font-bold text-gray-800 mb-4 pb-2 border-b border-gray-100 flex items-center gap-2">
          👤 Informações Pessoais
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">E-mail Corporativo</label>
            <p className="text-gray-700 font-medium mt-0.5">{profileData.email}</p>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">CPF</label>
            <p className="text-gray-700 font-medium mt-0.5">{profileData.cpf || 'Não registado'}</p>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Telefone</label>
            <p className="text-gray-700 font-medium mt-0.5">{profileData.telefone || '-'}</p>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Data de Nascimento</label>
            <p className="text-gray-700 font-medium mt-0.5">{formatarData(profileData.data_nascimento)}</p>
          </div>
          <div className="md:col-span-2">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Endereço Residencial</label>
            <p className="text-gray-700 font-medium mt-0.5">{profileData.endereco || 'Endereço não preenchido'}</p>
          </div>
        </div>
      </div>

      {/* Secção 2: Dados de Contrato */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
        <h2 className="text-lg font-bold text-gray-800 mb-4 pb-2 border-b border-gray-100 flex items-center gap-2">
          💼 Vínculo Empregatício
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Data de Admissão</label>
            <p className="text-gray-700 font-medium mt-0.5">{formatarData(profileData.data_admissao)}</p>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Tipo de Contrato</label>
            <p className="text-gray-700 font-medium mt-0.5">{profileData.tipo_contrato || 'CLT'}</p>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Nível Profissional</label>
            <p className="text-gray-700 font-medium mt-0.5">{profileData.nivel || 'Júnior'}</p>
          </div>
        </div>
      </div>

      {/* Secção 3: Dados Bancários */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
        <h2 className="text-lg font-bold text-gray-800 mb-4 pb-2 border-b border-gray-100 flex items-center gap-2">
          🏦 Dados Bancários
        </h2>
        {profileData.banco ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Instituição Bancária</label>
              <p className="text-gray-700 font-medium mt-0.5">{profileData.banco}</p>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Agência</label>
              <p className="text-gray-700 font-medium mt-0.5">{profileData.agencia}</p>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Conta ({profileData.tipo_conta || 'Corrente'})</label>
              <p className="text-gray-700 font-medium mt-0.5">{profileData.conta}</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500 italic">Nenhuma informação bancária registada até ao momento.</p>
        )}
      </div>

    </div>
  );
};

export default MyProfile;