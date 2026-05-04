import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { SendHorizontal, ShieldCheck, Zap, Sparkles } from "lucide-react";

export default function Contact() {
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    nomeEmpresa: '',
    nomeAdmin: '',
    email: '',
    senha: ''
  });
  
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErro('');
    setLoading(true);

    try {
      const resposta = await fetch('http://localhost:3000/api/auth/registrar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const dados = await resposta.json();

      if (!resposta.ok) {
        throw new Error(dados.erro || 'Erro ao criar conta');
      }

      setSucesso(true);
      setTimeout(() => {
        navigate('/login');
      }, 2000);

    } catch (err) {
      if (err instanceof Error) {
        setErro(err.message);
      } else {
        setErro('Ocorreu um erro inesperado.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="py-1 bg-white" id="contato">
      <div className="max-w-7xl mx-auto px-6">
        <div className="bg-indigo-600 rounded-[3rem] p-10 md:p-20 relative overflow-hidden shadow-[0_32px_64px_-12px_rgba(79,70,229,0.25)]">
          
          <div className="absolute -top-24 -left-24 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-indigo-400/20 rounded-full blur-3xl pointer-events-none"></div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center relative z-10">
            
            <div className="text-left text-white">
              <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 px-4 py-2 rounded-full text-indigo-100 text-xs font-black tracking-widest uppercase mb-6">
                <Sparkles size={14} /> Junte-se a +2.000 empresas
              </div>
              <h2 className="text-4xl md:text-5xl font-black leading-tight mb-8">
                Pronto para transformar sua gestão?
              </h2>
              
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="bg-white/10 p-3 rounded-2xl text-white">
                    <Zap size={24} />
                  </div>
                  <p className="font-bold text-lg opacity-90 text-indigo-50">Automação total de holerites e impostos.</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="bg-white/10 p-3 rounded-2xl text-white">
                    <ShieldCheck size={24} />
                  </div>
                  <p className="font-bold text-lg opacity-90 text-indigo-50">Segurança de dados padrão bancário.</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-[2.5rem] p-8 md:p-10 shadow-2xl">
              <form className="space-y-4" onSubmit={handleSubmit}>
                
                {erro && <div className="p-4 bg-red-50 text-red-600 rounded-2xl font-bold text-sm mb-4 border border-red-100">{erro}</div>}
                {sucesso && <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl font-bold text-sm mb-4 border border-emerald-100">Conta criada com sucesso! Redirecionando...</div>}

                
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome Completo</label>
                    <input
                      type="text"
                      name="nomeAdmin" 
                      value={formData.nomeAdmin} 
                      onChange={handleChange} 
                      placeholder="Ex: João Silva"
                      required
                      className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:border-indigo-600 focus:bg-white outline-none font-bold text-slate-900 transition-all placeholder:text-slate-300"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome da Empresa</label>
                    <input
                      type="text"
                      name="nomeEmpresa" 
                      value={formData.nomeEmpresa} 
                      onChange={handleChange} 
                      placeholder="Sua empresa"
                      required
                      className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:border-indigo-600 focus:bg-white outline-none font-bold text-slate-900 transition-all placeholder:text-slate-300"
                    />
                  </div>
                

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">E-mail Corporativo</label>
                  <input
                    type="email"
                    name="email" 
                    value={formData.email} 
                    onChange={handleChange} 
                    placeholder="email@empresa.com"
                    required
                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:border-indigo-600 focus:bg-white outline-none font-bold text-slate-900 transition-all placeholder:text-slate-300"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Senha de Acesso</label>
                  <input
                    type="password"
                    name="senha" 
                    value={formData.senha} 
                    onChange={handleChange} 
                    placeholder="••••••••"
                    required
                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:border-indigo-600 focus:bg-white outline-none font-bold text-slate-900 transition-all placeholder:text-slate-300"
                  />
                </div>

                <div className="pt-4 flex flex-col gap-4">
                  <button 
                    type="submit" 
                    disabled={loading || sucesso} 
                    className="w-full py-5 bg-slate-900 hover:bg-indigo-600 text-white font-black rounded-2xl transition-all shadow-xl active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {loading ? 'Processando...' : (
                      <>Criar Minha Conta <SendHorizontal size={18} /></>
                    )}
                  </button>

                  <p className="text-center text-sm font-bold text-slate-400">
                    Já possui conta? <Link to="/login" className="text-indigo-600 hover:underline">Faça login aqui</Link>
                  </p>
                </div>

              </form>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}