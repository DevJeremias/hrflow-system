import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Lock, Mail, AlertCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { HttpError } from '../../services/httpClient';
import { mensagemDeLimite } from '../../utils/espera';
import { mensagemDeErro } from '../../utils/erros';
import { usePageTitle } from '../../hooks/usePageTitle';
import Button from '../../components/ui/Button';
import Field, { Input } from '../../components/ui/Field';
import logo from '../../assets/logo.png';
import loginImagem from '../../assets/login_imagem2.webp';

const Login: React.FC = () => {
  usePageTitle('Entrar');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login, sessionNotice } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    setIsSubmitting(true);

    try {
      await login(email, senha);
    } catch (error) {
      const mensagem = mensagemDeErro(error, 'Erro ao realizar login.');
      setErro(error instanceof HttpError && error.status === 429 ? mensagemDeLimite(error.data, mensagem) : mensagem);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full bg-surface">
      <div data-escuro className="relative hidden flex-[1.4] bg-surface-inverse lg:flex">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-cover bg-center opacity-25"
          style={{ backgroundImage: `url(${loginImagem})` }}
        />

        <div className="relative z-10 flex h-full w-full flex-col justify-between py-12 pl-10 pr-12 xl:py-16 xl:pl-20">
          <div className="flex items-center gap-3">
            <img src={logo} alt="" className="h-10 w-auto object-contain md:h-12" />
            <span className="text-2xl font-extrabold tracking-tight text-white">
              HR<span className="text-indigo-300">Flow</span>
            </span>
          </div>

          <div className="max-w-xl">
            <p className="mb-6 text-3xl font-extrabold leading-[1.1] text-white xl:text-5xl">
              Sistema de Gestão de Recursos Humanos
            </p>
            <p className="max-w-md text-xl font-medium leading-relaxed text-slate-300">
              Gerencie colaboradores, ponto, férias e folha de pagamento em um só lugar.
            </p>
          </div>
        </div>
      </div>

      <main className="flex flex-1 flex-col justify-center bg-surface px-6 py-12 sm:px-10 lg:px-24 xl:px-32">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-10">
            <h1 className="mb-2 text-4xl font-extrabold tracking-tight text-ink">Bem-vindo!</h1>
            <p className="text-lg text-ink-muted">Informe suas credenciais para acessar.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <Field label="E-mail" name="email" required>
              <Input
                type="email"
                autoComplete="username"
                placeholder="exemplo@email.com"
                icon={<Mail size={20} />}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>

            <Field label="Senha" name="senha" required>
              <Input
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                icon={<Lock size={20} />}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
              />
            </Field>

            <p className="text-sm text-ink-muted">
              <span className="font-semibold text-ink">Esqueceu a senha?</span> Procure o RH da sua empresa: ele redefine o seu acesso.
            </p>

            {sessionNotice && !erro && (
              <div role="status" className="flex items-center gap-2 rounded-control border border-warning-line bg-warning-soft p-4 text-sm font-semibold text-warning">
                <AlertCircle size={18} aria-hidden="true" className="shrink-0" />
                <p>{sessionNotice}</p>
              </div>
            )}

            {erro && (
              <div role="alert" className="flex items-center gap-2 rounded-control border border-danger-line bg-danger-soft p-4 text-sm font-semibold text-danger">
                <AlertCircle size={18} aria-hidden="true" className="shrink-0" />
                <p>{erro}</p>
              </div>
            )}

            <Button type="submit" size="lg" fullWidth loading={isSubmitting}>
              {isSubmitting ? 'Acessando...' : 'Acessar sistema'}
            </Button>
          </form>

          <div className="mt-12 border-t border-line pt-8 text-center">
            <p className="font-medium text-ink-muted">
              Ainda não tem cadastro?{' '}
              <Link to="/#contato" className="font-bold text-brand underline underline-offset-4 hover:text-brand-hover">
                Cadastre sua empresa
              </Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Login;
