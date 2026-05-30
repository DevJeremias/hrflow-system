import React from 'react';

interface Props {
  formData: any;
  handleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const PersonalTab: React.FC<Props> = ({ formData, handleChange }) => {
  return (
    <div className="space-y-5 animate-in slide-in-from-right-4 duration-300">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">Nome Completo *</label>
          <input type="text" name="nomeCompleto" required value={formData.nomeCompleto} onChange={handleChange} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none" placeholder="João da Silva" />
        </div>
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">E-mail Pessoal *</label>
          <input type="email" name="emailPessoal" required value={formData.emailPessoal} onChange={handleChange} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none" placeholder="joao@email.com" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">Telefone</label>
          <input type="tel" name="telefone" value={formData.telefone} onChange={handleChange} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none" placeholder="(11) 98765-4321" />
        </div>
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">CPF *</label>
          <input type="text" name="cpf" required value={formData.cpf} onChange={handleChange} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none" placeholder="123.456.789-00" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">Data de Nascimento *</label>
          <input type="date" name="dataNascimento" required value={formData.dataNascimento} onChange={handleChange} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none" />
        </div>
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">Senha de Acesso *</label>
          <input type="password" name="senhaAcesso" value={formData.senhaAcesso} onChange={handleChange} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none" placeholder="........" />
        </div>
      </div>

      <div>
        <label className="block text-sm font-bold text-slate-700 mb-2">Endereço Completo</label>
        <input type="text" name="enderecoCompleto" value={formData.enderecoCompleto} onChange={handleChange} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none" placeholder="Rua, número, bairro, cidade - UF" />
      </div>
    </div>
  );
};
export default PersonalTab;