import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { SendHorizontal, ShieldCheck, Zap, Sparkles } from "lucide-react";
import httpClient from '../../services/httpClient';
import Button from '../../components/ui/Button';
import Field, { Input } from '../../components/ui/Field';

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
      await httpClient('/auth/registrar', {
        method: 'POST',
        body: JSON.stringify(formData),
        errorMessage: (data) => data?.erro || 'Erro ao criar conta'
      });

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
        <div className="bg-brand rounded-[3rem] p-10 md:p-20 relative overflow-hidden shadow-[0_32px_64px_-12px_rgba(79,70,229,0.25)]">
          
          <div className="absolute -top-24 -left-24 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-indigo-400/20 rounded-full blur-3xl pointer-events-none"></div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center relative z-10">
            
            <div className="text-left text-white">
              <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 px-4 py-2 rounded-full text-white text-xs font-black tracking-widest uppercase mb-6">
                <Sparkles size={14} aria-hidden="true" /> Cadastro da empresa
              </div>
              <h2 className="text-4xl md:text-5xl font-black leading-tight mb-8">
                Crie a conta da sua empresa.
              </h2>
              
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="bg-white/10 p-3 rounded-2xl text-white">
                    <Zap size={24} />
                  </div>
                  <p className="font-bold text-lg text-white">Folha em lote com desconto de INSS e holerite por colaborador.</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="bg-white/10 p-3 rounded-2xl text-white">
                    <ShieldCheck size={24} />
                  </div>
                  <p className="font-bold text-lg text-white">Acesso separado por perfil e sessão protegida.</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-[2.5rem] p-8 md:p-10 shadow-2xl">
              <form className="space-y-4" onSubmit={handleSubmit}>

                {erro && <div role="alert" className="p-4 bg-danger-soft text-danger rounded-card font-semibold text-sm border border-danger-line">{erro}</div>}
                {sucesso && <div role="status" className="p-4 bg-success-soft text-success rounded-card font-semibold text-sm border border-success-line">Conta criada com sucesso! Redirecionando...</div>}

                <Field label="Nome completo" name="nomeAdmin" required>
                  <Input type="text" autoComplete="name" value={formData.nomeAdmin} onChange={handleChange} placeholder="Ex: João Silva" />
                </Field>
                <Field label="Nome da empresa" name="nomeEmpresa" required>
                  <Input type="text" autoComplete="organization" value={formData.nomeEmpresa} onChange={handleChange} placeholder="Sua empresa" />
                </Field>
                <Field label="E-mail corporativo" name="email" required>
                  <Input type="email" autoComplete="email" value={formData.email} onChange={handleChange} placeholder="email@empresa.com" />
                </Field>
                <Field label="Senha de acesso" name="senha" required>
                  <Input type="password" autoComplete="new-password" value={formData.senha} onChange={handleChange} placeholder="••••••••" />
                </Field>

                <div className="pt-4 flex flex-col gap-4">
                  <Button type="submit" size="lg" fullWidth loading={loading} disabled={sucesso}>
                    {loading ? 'Processando...' : (
                      <>Criar minha conta <SendHorizontal size={18} aria-hidden="true" /></>
                    )}
                  </Button>

                  <p className="text-center text-xs font-medium text-ink-muted">
                    Ao criar a conta você declara ter lido os <Link to="/termos" className="text-brand underline underline-offset-2 hover:text-brand-hover">Termos de Uso</Link> e a <Link to="/privacidade" className="text-brand underline underline-offset-2 hover:text-brand-hover">Política de Privacidade</Link>.
                  </p>

                  <p className="text-center text-sm font-semibold text-ink-muted">
                    Já possui conta? <Link to="/login" className="text-brand underline underline-offset-2 hover:text-brand-hover">Faça login aqui</Link>
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