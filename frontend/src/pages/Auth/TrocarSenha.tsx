import React, { useState } from 'react';
import { Lock, Loader2, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { userService } from '../../services/userService';
import { HttpError } from '../../services/httpClient';
import { mensagemDeErro } from '../../utils/erros';
import { mensagemDeLimite } from '../../utils/espera';
import ErrorAlert from '../../components/ErrorAlert';
import logo from '../../assets/logo.png';

// A troca encerra a sessão no servidor; o aviso no login explica a volta.
const AVISO_SENHA_DEFINIDA = 'Senha definida. Entre com a nova senha.';

const classeDoCampo = 'w-full pl-14 pr-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-white outline-none transition-all font-semibold text-slate-700';

// Primeira etapa de quem entrou com a senha que o RH definiu ou redefiniu: o servidor só aceita a
// troca (403 no resto), então não há outra tela a mostrar até ela.
const TrocarSenha: React.FC = () => {
  const { user, logout } = useAuth();
  const [senhas, setSenhas] = useState({ atual: '', nova: '', confirmacao: '' });
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  const alterar = (campo: keyof typeof senhas) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setSenhas((atuais) => ({ ...atuais, [campo]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (enviando) return;
    setErro('');
    if (senhas.nova !== senhas.confirmacao) return setErro('As senhas não coincidem.');

    setEnviando(true);
    try {
      await userService.changeMyPassword(senhas.atual, senhas.nova);
    } catch (error) {
      const mensagem = mensagemDeErro(error, 'Erro ao definir a nova senha.');
      setErro(error instanceof HttpError && error.status === 429 ? mensagemDeLimite(error.data, mensagem) : mensagem);
      setEnviando(false);
      return;
    }
    await logout(AVISO_SENHA_DEFINIDA);
  };

  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-slate-50 px-4 py-10 font-sans">
      <div className="w-full max-w-md rounded-[2rem] border border-slate-100 bg-white p-6 shadow-xl sm:p-10">
        <div className="mb-8 flex items-center gap-3">
          <img src={logo} alt="" className="h-10 w-auto object-contain" />
          <span className="text-2xl font-black tracking-tight text-slate-900">HR<span className="text-purple-500">flow</span></span>
        </div>

        <h1 className="mb-2 flex items-center gap-2 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
          <ShieldCheck className="shrink-0 text-emerald-500" /> Defina a sua senha
        </h1>
        <p className="mb-8 font-medium text-slate-500">
          {user ? `${user.nome}, a` : 'A'} senha que você recebeu é provisória. Escolha uma só sua para continuar.
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="senha-atual" className="mb-2 ml-1 block text-sm font-bold text-slate-700">SENHA PROVISÓRIA</label>
            <div className="relative">
              <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <input id="senha-atual" name="senhaAtual" type="password" autoComplete="current-password" required value={senhas.atual} onChange={alterar('atual')} className={classeDoCampo} />
            </div>
          </div>
          <div>
            <label htmlFor="senha-nova" className="mb-2 ml-1 block text-sm font-bold text-slate-700">NOVA SENHA</label>
            <div className="relative">
              <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <input id="senha-nova" name="novaSenha" type="password" autoComplete="new-password" required minLength={8} value={senhas.nova} onChange={alterar('nova')} className={classeDoCampo} />
            </div>
            <p className="ml-1 mt-2 text-xs font-medium text-slate-500">Mínimo de 8 caracteres e diferente da senha provisória.</p>
          </div>
          <div>
            <label htmlFor="senha-confirmacao" className="mb-2 ml-1 block text-sm font-bold text-slate-700">CONFIRMAR NOVA SENHA</label>
            <div className="relative">
              <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <input id="senha-confirmacao" name="confirmacao" type="password" autoComplete="new-password" required value={senhas.confirmacao} onChange={alterar('confirmacao')} className={classeDoCampo} />
            </div>
          </div>

          {erro && <ErrorAlert message={erro} />}

          <button type="submit" disabled={enviando} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-lg font-extrabold text-white shadow-xl shadow-indigo-100 transition-all hover:bg-indigo-300 active:scale-[0.98] disabled:bg-primary/70">
            {enviando ? <><Loader2 className="animate-spin" size={20} /><span>SALVANDO...</span></> : 'DEFINIR SENHA'}
          </button>
        </form>

        <button type="button" onClick={() => logout()} className="mt-6 text-sm font-bold text-slate-500 underline underline-offset-4 hover:text-slate-700">
          Sair
        </button>
      </div>
    </main>
  );
};

export default TrocarSenha;
