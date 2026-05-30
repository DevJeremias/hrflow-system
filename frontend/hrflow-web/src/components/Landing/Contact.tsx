import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { SendHorizontal, ShieldCheck, Zap, Sparkles } from "lucide-react";

export default function Contact() {
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    nomeEmpresa: '', nomeAdmin: '', email: '', senha: ''
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
      if (!resposta.ok) throw new Error(dados.erro || 'Erro ao criar conta');

      setSucesso(true);
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Ocorreu um erro inesperado.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="relative py-32 bg-zinc-800 overflow-hidden" id="contato">
      
      <div className="absolute top-0 left-0 w-full overflow-hidden leading-none z-10">
        <svg 
          viewBox="0 0 1200 120" 
          preserveAspectRatio="none" 
          className="relative block w-full h-[60px] md:h-[120px]"
        >
          <path 
            d="M321.39,56.44c58-10.79,114.16-30.13,172-41.86,82.39-16.72,168.19-17.73,250.45-.39C823.78,31,906.67,72,985.66,92.83c70.05,18.48,146.53,26.09,214.34,3V0H0V27.35A600.21,600.21,0,0,0,321.39,56.44Z" 
            className="fill-slate-900"
          ></path>
        </svg>
      </div>

      <div className="max-w-7xl mx-auto px-6 relative z-20 pt-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
          
          <div className="lg:col-span-6 text-left">
            <div className="inline-flex items-center gap-2 bg-zinc-900/50 border border-zinc-700 px-4 py-2 rounded-full text-zinc-300 text-xs font-black tracking-widest uppercase mb-6 backdrop-blur-sm">
              <Sparkles size={14} className="text-orange-500" /> Junte-se a +2.000 empresas
            </div>
            
            <h2 className="text-4xl md:text-5xl font-black leading-tight text-white tracking-tighter mb-8">
              Pronto para transformar <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-rose-500">
                sua gestão?
              </span>
            </h2>
            
            <div className="space-y-6 pt-8 border-t border-zinc-700">
              <div className="flex items-start gap-4">
                <div className="bg-orange-500/10 border border-orange-500/20 p-3 rounded-2xl text-orange-500 shrink-0">
                  <Zap size={24} />
                </div>
                <div>
                  <p className="font-bold text-lg text-white">Automação total.</p>
                  <p className="text-sm text-zinc-400 font-medium mt-0.5">Cálculos precisos e atualizações em tempo real.</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="bg-orange-500/10 border border-orange-500/20 p-3 rounded-2xl text-orange-500 shrink-0">
                  <ShieldCheck size={24} />
                </div>
                <div>
                  <p className="font-bold text-lg text-white">Segurança Bancária.</p>
                  <p className="text-sm text-zinc-400 font-medium mt-0.5">Conformidade LGPD e criptografia de ponta.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-6 relative w-full flex justify-center lg:justify-end">
            
            <div className="absolute -left-8 md:-left-12 -top-8 w-[280px] h-[280px] bg-orange-600 rounded-full z-0 opacity-100 shadow-xl"></div>
            
            <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-zinc-700 rounded-full z-0 opacity-50"></div>

            <div className="relative z-10 bg-white rounded-[2.5rem] p-10 border border-slate-100 text-slate-900 w-full max-w-lg shadow-2xl">
              
              <div className="mb-8 text-center">
                <h3 className="text-2xl font-black text-slate-950 tracking-tight">Criar Conta</h3>
                <p className="text-sm text-slate-500 font-medium mt-1">Preencha os dados da sua empresa abaixo.</p>
              </div>

              <form className="space-y-4" onSubmit={handleSubmit}>
                
                {erro && <div className="p-4 bg-red-50 text-red-600 rounded-2xl font-bold text-sm mb-4 border border-red-100">{erro}</div>}
                {sucesso && <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl font-bold text-sm mb-4 border border-emerald-100">Conta criada com sucesso!</div>}

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome Completo</label>
                  <input type="text" name="nomeAdmin" value={formData.nomeAdmin} onChange={handleChange} placeholder="Ex: João Silva" required className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:border-orange-500 focus:bg-white outline-none font-bold text-slate-900 transition-all placeholder:text-slate-300" />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome da Empresa</label>
                  <input type="text" name="nomeEmpresa" value={formData.nomeEmpresa} onChange={handleChange} placeholder="Sua empresa" required className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:border-orange-500 focus:bg-white outline-none font-bold text-slate-900 transition-all placeholder:text-slate-300" />
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">E-mail Corporativo</label>
                  <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="email@empresa.com" required className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:border-orange-500 focus:bg-white outline-none font-bold text-slate-900 transition-all placeholder:text-slate-300" />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Senha de Acesso</label>
                  <input type="password" name="senha" value={formData.senha} onChange={handleChange} placeholder="••••••••" required className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:border-orange-500 focus:bg-white outline-none font-bold text-slate-900 transition-all placeholder:text-slate-300" />
                </div>

                <div className="pt-4 flex flex-col gap-4">
                  <button type="submit" disabled={loading || sucesso} className="w-full py-5 bg-orange-600 hover:bg-orange-500 text-white font-black rounded-xl transition-all shadow-[0_10px_30px_-5px_rgba(234,88,12,0.4)] active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 text-base">
                    {loading ? 'Processando...' : <><SendHorizontal size={18} /> Cadastrar Empresa</>}
                  </button>

                  <p className="text-center text-sm font-bold text-slate-400 mt-2">
                    Já possui conta? <Link to="/login" className="text-orange-600 hover:underline">Faça login aqui</Link>
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