import React from 'react';

// ==========================================
// ABA 1: DADOS PESSOAIS
// ==========================================
interface TabProps {
  formData: any;
  handleChange: (e: any) => void;
}

export const PersonalTab: React.FC<TabProps> = ({ formData, handleChange }) => (
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
        <label className="block text-sm font-bold text-slate-700 mb-2">CPF</label>
        <input type="text" name="cpf" value={formData.cpf} onChange={handleChange} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none" placeholder="123.456.789-00" />
      </div>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label className="block text-sm font-bold text-slate-700 mb-2">Data de Nascimento</label>
        <input type="date" name="dataNascimento" value={formData.dataNascimento} onChange={handleChange} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none" />
      </div>
      <div>
        <label className="block text-sm font-bold text-slate-700 mb-2">Senha de Acesso *</label>
        <input type="password" name="senhaAcesso" required value={formData.senhaAcesso} onChange={handleChange} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none" placeholder="........" />
      </div>
    </div>

    <div>
      <label className="block text-sm font-bold text-slate-700 mb-2">Endereço Completo</label>
      <input type="text" name="enderecoCompleto" value={formData.enderecoCompleto} onChange={handleChange} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none" placeholder="Rua, número, bairro, cidade - UF" />
    </div>
  </div>
);

// ==========================================
// ABA 2: CONTRATO DE TRABALHO
// ==========================================
interface WorkTabProps extends TabProps {
  cargos?: any[];
  departamentos?: any[];
}

export const WorkTab: React.FC<WorkTabProps> = ({ formData, handleChange, cargos = [], departamentos = [] }) => (
  <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
    
    <div className="grid grid-cols-1 gap-6">
      <div className="space-y-2">
        <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Data de Admissão</label>
        <input name="dataAdmissao" type="date" value={formData.dataAdmissao} onChange={handleChange} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:border-primary outline-none font-bold text-slate-700" />
      </div>
    </div>

    <div className="grid grid-cols-2 gap-6">
      <div className="space-y-2">
        <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Cargo</label>
        <select name="cargo" value={formData.cargo} onChange={handleChange} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:border-primary outline-none cursor-pointer font-bold text-slate-800">
          <option value="">Selecione o Cargo...</option>
          {cargos.map((c: any) => <option key={c.id} value={c.title}>{c.title}</option>)}
        </select>
      </div>
      <div className="space-y-2">
        <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Nível Hierárquico</label>
        <select name="nivel" value={formData.nivel} onChange={handleChange} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:border-primary outline-none cursor-pointer font-bold text-indigo-700 bg-indigo-50/50">
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
        <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Setor / Departamento</label>
        <select name="departamento" value={formData.departamento} onChange={handleChange} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:border-primary outline-none cursor-pointer">
          <option value="">Selecione o Setor...</option>
          {departamentos.map((d: any) => <option key={d.id} value={d.name}>{d.name}</option>)}
        </select>
      </div>
      <div className="space-y-2">
        <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Tipo de Contrato</label>
        <select name="tipoContrato" value={formData.tipoContrato} onChange={handleChange} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:border-primary outline-none cursor-pointer">
          <option value="CLT">CLT</option>
          <option value="PJ">PJ</option>
          <option value="Estágio">Estágio</option>
          <option value="Temporário">Temporário</option>
        </select>
      </div>
    </div>

    <div className="space-y-2 bg-slate-100 p-6 rounded-[2rem] mt-2">
      <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Salário Base (Bruto)</label>
      <div className="relative">
        <span className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 font-black text-xl">R$</span>
        <input name="salarioBase" type="number" value={formData.salarioBase} onChange={handleChange} className="w-full pl-16 pr-6 py-5 bg-white border-2 border-transparent focus:border-primary rounded-2xl outline-none font-black text-2xl text-slate-900 shadow-sm transition-all" placeholder="0.00" />
      </div>
    </div>
  </div>
);

// ==========================================
// ABA 3: DADOS FINANCEIROS
// ==========================================
export const FinancialTab: React.FC<TabProps> = ({ formData, handleChange }) => (
  <div className="space-y-5 animate-in slide-in-from-left-4 duration-300">
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label className="block text-sm font-bold text-slate-700 mb-2">Banco</label>
        <input type="text" name="banco" value={formData.banco} onChange={handleChange} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-primary" placeholder="Ex: Banco do Brasil" />
      </div>
      <div>
        <label className="block text-sm font-bold text-slate-700 mb-2">Agência</label>
        <input type="text" name="agencia" value={formData.agencia} onChange={handleChange} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-primary" placeholder="1234-5" />
      </div>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label className="block text-sm font-bold text-slate-700 mb-2">Conta</label>
        <input type="text" name="conta" value={formData.conta} onChange={handleChange} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-primary" placeholder="12345-6" />
      </div>
      <div>
        <label className="block text-sm font-bold text-slate-700 mb-2">Tipo de Conta</label>
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