import React from 'react';

const WorkTab = ({ formData, handleChange, cargos = [], departamentos = [] }: any) => (
  <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
    
    <div className="grid grid-cols-2 gap-6">
      <div className="space-y-2">
        <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Matrícula *</label>
        <input name="matricula" required value={formData.matricula} onChange={handleChange} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:border-primary outline-none font-bold placeholder:font-normal" placeholder="Ex: COL-999" />
      </div>
      <div className="space-y-2">
        <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Data de Admissão *</label>
        <input name="dataAdmissao" type="date" required value={formData.dataAdmissao} onChange={handleChange} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:border-primary outline-none font-bold text-slate-700" />
      </div>
    </div>

    <div className="grid grid-cols-2 gap-6">
      <div className="space-y-2">
        <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Cargo *</label>
        <select name="cargo" required value={formData.cargo} onChange={handleChange} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:border-primary outline-none cursor-pointer font-bold text-slate-800">
          <option value="">Selecione o Cargo...</option>
          {cargos.map((c: any) => <option key={c.id} value={c.title}>{c.title}</option>)}
        </select>
      </div>
      <div className="space-y-2">
        <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Nível Hierárquico *</label>
        <select name="nivel" required value={formData.nivel} onChange={handleChange} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:border-primary outline-none cursor-pointer font-bold text-indigo-700 bg-indigo-50/50">
          <option value="">Selecione o Nível...</option>
          <option value="Júnior">Júnior</option>
          <option value="Pleno">Pleno</option>
          <option value="Sênior">Sênior</option>
          <option value="Gestão">Gestão</option>
          <option value="Coordenação">Coordenação</option>
        </select>
      </div>
    </div>

    <div className="grid grid-cols-2 gap-6">
      <div className="space-y-2">
        <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Setor / Departamento *</label>
        <select name="departamento" required value={formData.departamento} onChange={handleChange} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:border-primary outline-none cursor-pointer">
          <option value="">Selecione o Setor...</option>
          {departamentos.map((d: any) => <option key={d.id} value={d.name}>{d.name}</option>)}
        </select>
      </div>
      <div className="space-y-2">
        <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Tipo de Contrato *</label>
        <select name="tipoContrato" value={formData.tipoContrato} onChange={handleChange} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:border-primary outline-none cursor-pointer">
          <option value="CLT">CLT (Consolidação das Leis do Trabalho)</option>
          <option value="PJ">PJ (Pessoa Jurídica)</option>
          <option value="Estágio">Estágio</option>
          <option value="Temporário">Temporário</option>
        </select>
      </div>
    </div>

    <div className="space-y-2 bg-slate-100 p-6 rounded-[2rem] mt-2">
      <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Salário Base (Bruto) *</label>
      <div className="relative">
        <span className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 font-black text-xl">R$</span>
        <input name="salarioBase" type="number" required value={formData.salarioBase} onChange={handleChange} className="w-full pl-16 pr-6 py-5 bg-white border-2 border-transparent focus:border-primary rounded-2xl outline-none font-black text-2xl text-slate-900 shadow-sm transition-all" placeholder="0.00" />
      </div>
    </div>

    {(formData.cargoEarnings?.length > 0 || formData.cargoDeductions?.length > 0) && (
      <div className="pt-6 border-t border-slate-100">
        <h4 className="text-sm font-black text-slate-800 uppercase tracking-tighter mb-4">Composição Padrão do Cargo</h4>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-emerald-50 border border-emerald-100 p-5 rounded-[2rem]">
            <span className="text-[10px] font-black text-emerald-700 uppercase block mb-3">Proventos Padrão</span>
            {formData.cargoEarnings.map((item: any, i: number) => (
              <div key={i} className="flex justify-between text-xs font-bold text-emerald-800 mb-2 last:mb-0">
                <span>{item.description}</span>
                <span className="bg-emerald-100 px-2 py-0.5 rounded-md">{item.valueType === 'percentage' ? `+ ${item.value}%` : `+ R$ ${item.value}`}</span>
              </div>
            ))}
          </div>
          <div className="bg-rose-50 border border-rose-100 p-5 rounded-[2rem]">
            <span className="text-[10px] font-black text-rose-700 uppercase block mb-3">Descontos Padrão</span>
            {formData.cargoDeductions.map((item: any, i: number) => (
              <div key={i} className="flex justify-between text-xs font-bold text-rose-800 mb-2 last:mb-0">
                <span>{item.description}</span>
                <span className="bg-rose-100 px-2 py-0.5 rounded-md">{item.valueType === 'percentage' ? `- ${item.value}%` : `- R$ ${item.value}`}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    )}
  </div>
);

export default WorkTab;