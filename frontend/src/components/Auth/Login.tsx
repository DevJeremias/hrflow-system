import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Lock, Mail, Loader2, AlertCircle } from 'lucide-react'; 
import { useAuth } from '../../AuthContext'; 

const Login: React.FC = () => {
  const bgImage = new URL('../../assets/login_imagem2.png', import.meta.url).href;
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState(''); // Estado para mensagem de erro
  const [isSubmitting, setIsSubmitting] = useState(false); // Estado para o botão carregando
  
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(''); 
    setIsSubmitting(true); 

    try {
      await login(email, senha);
    } catch (error: any) {
      setErro(error.message || 'Erro ao realizar login.');
    } finally {
      setIsSubmitting(false); 
    }
  };

  return (
    <div className="flex min-h-screen w-full font-sans bg-white overflow-hidden">
      
      <div className="hidden lg:flex flex-[1.4] relative bg-[#0a0f1d]">
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-25" 
          style={{ backgroundImage: `url(${bgImage})` }}
        />
        
        <div className="relative z-10 flex flex-col justify-between w-full h-full pt-12 pb-12 pl-10 pr-12 xl:pt-16 xl:pb-16 xl:pl-20">
          
          <div className="flex items-center gap-3">
            <div className="bg-primary p-2.5 rounded-xl shadow-lg shadow-indigo-500/20">
              <span className="text-white font-black text-xl leading-none">HR</span>
            </div>
            <span className="text-white font-bold text-2xl tracking-tight">Sistema RH</span>
          </div>

          <div className="max-w-xl">
            <h2 className="text-3xl xl:text-5xl font-black text-white leading-[1.1] mb-6">
              Sistema de Gestão de <br /> Recursos Humanos
            </h2>
            <p className="text-xl text-slate-300 font-medium leading-relaxed max-w-md">
              Gerencie colaboradores, ponto, férias e folha de pagamento em um só lugar.
            </p>
          </div>
        </div>
      </div>

      <div className="flex-2 flex flex-col justify-center px-10 lg:px-24 xl:px-32 bg-white">
        <div className="max-w-md w-full mx-auto">
          
          <div className="mb-10">
            <h2 className="text-4xl font-black text-slate-900 tracking-tighter mb-2">Bem-vindo!</h2>
            <p className="text-slate-500 font-medium text-lg">Introduza as suas credenciais para aceder.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2 ml-1">E-MAIL</label>
              <div className="relative group">
                <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={20} />
                <input 
                  type="email" 
                  placeholder="exemplo@email.com"
                  className="w-full pl-14 pr-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-white outline-none transition-all font-semibold text-slate-700"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2 ml-1">SENHA</label>
              <div className="relative group">
                <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={20} />
                <input 
                  type="password" 
                  placeholder="••••••••"
                  className="w-full pl-14 pr-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-white outline-none transition-all font-semibold text-slate-700"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="flex justify-end pt-0">
              <a href="#" className="text-sm font-bold text-primary hover:text-indigo-700 transition-colors">
                Esqueceu a senha?
              </a>
            </div>

            {erro && (
              <div className="flex items-center gap-2 p-4 bg-red-50 text-red-600 rounded-xl text-sm font-bold border border-red-100">
                <AlertCircle size={18} />
                <p>{erro}</p>
              </div>
            )}

            <button 
              type="submit"
              disabled={isSubmitting} 
              className="w-full py-5 bg-primary hover:bg-indigo-300 disabled:bg-primary/70 text-white font-extrabold text-lg rounded-2xl shadow-xl shadow-indigo-100 hover:shadow-indigo-200 transition-all transform active:scale-[0.98] mt-2 flex justify-center items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  <span>ACESSANDO...</span>
                </>
              ) : (
                'ACESSAR SISTEMA'
              )}
            </button>
          </form>

          <div className="mt-12 pt-8 border-t border-slate-300 text-center">
            <p className="text-slate-500 font-semibold">
              Ainda não tem cadastro?{' '}
              <Link to="/#contato" className="text-primary font-black hover:underline underline-offset-4 transition-all">
                Cadastre sua empresa
              </Link>
            </p>
          </div>
          
        </div>
      </div>
    </div>
  );
};

export default Login;