import React from 'react';

interface Props {
  formData: any;
  handleChange: (e: any) => void;
}

const FinancialTab: React.FC<Props> = ({ formData, handleChange }) => {
  return (
    <div className="space-y-5 animate-in slide-in-from-left-4 duration-300">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">Banco *</label>
          <input type="text" name="banco" value={formData.banco} onChange={handleChange} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-primary" placeholder="Ex: Banco do Brasil" />
        </div>
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">Agência *</label>
          <input type="text" name="agencia" value={formData.agencia} onChange={handleChange} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-primary" placeholder="1234-5" />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">Conta *</label>
          <input type="text" name="conta" value={formData.conta} onChange={handleChange} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-primary" placeholder="12345-6" />
        </div>
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">Tipo de Conta *</label>
          <select name="tipoConta" value={formData.tipoConta} onChange={handleChange} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-primary">
            <option value="">Selecione...</option>
            <option value="Corrente">Conta Corrente</option>
            <option value="Poupanca">Conta Poupança</option>
            <option value="Salario">Conta Salário</option>
          </select>
        </div>
      </div>
    </div>
  );
};
export default FinancialTab;