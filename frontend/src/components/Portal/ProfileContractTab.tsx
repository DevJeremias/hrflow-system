import React from 'react';
import { PerfilUsuario } from '../../services/userService';

interface Props {
  perfil: PerfilUsuario;
}

const ProfileContractTab: React.FC<Props> = ({ perfil }) => {
  // A API manda a data como AAAA-MM-DD; passar por Date a deslocaria um dia no fuso do navegador.
  const formatarData = (dataString: string | null) => {
    if (!dataString) return '-';
    const [ano, mes, dia] = dataString.slice(0, 10).split('-');
    return `${dia}/${mes}/${ano}`;
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      
      <div>
        <h2 className="text-xl font-black text-slate-900 mb-6 border-b border-slate-100 pb-4">Vínculo Empregatício</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-4 bg-slate-50 rounded-2xl">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Data de Admissão</label>
            <span className="font-bold text-slate-900">{formatarData(perfil.data_admissao)}</span>
          </div>
          <div className="p-4 bg-slate-50 rounded-2xl">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Tipo de Contrato</label>
            <span className="font-bold text-slate-900">{perfil.tipo_contrato || 'Não informado'}</span>
          </div>
          <div className="p-4 bg-slate-50 rounded-2xl">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Nível Profissional</label>
            <span className="font-bold text-slate-900">{perfil.nivel || 'Não definido'}</span>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-black text-slate-900 mb-6 border-b border-slate-100 pb-4">Dados Bancários</h2>
        {perfil.banco ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="md:col-span-2 p-4 bg-slate-50 rounded-2xl">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Instituição Bancária</label>
              <span className="font-bold text-slate-900">{perfil.banco}</span>
            </div>
            <div className="p-4 bg-slate-50 rounded-2xl">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Agência</label>
              <span className="font-bold text-slate-900">{perfil.agencia}</span>
            </div>
            <div className="p-4 bg-slate-50 rounded-2xl">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Conta ({perfil.tipo_conta || 'Corrente'})</label>
              <span className="font-bold text-slate-900">{perfil.conta}</span>
            </div>
          </div>
        ) : (
          <p className="text-sm font-bold text-slate-400 bg-slate-50 p-6 rounded-2xl text-center">Nenhuma informação bancária registrada.</p>
        )}
      </div>

    </div>
  );
};

export default ProfileContractTab;