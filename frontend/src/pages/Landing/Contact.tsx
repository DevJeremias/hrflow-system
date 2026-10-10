import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { SendHorizontal, ShieldCheck, Zap, Sparkles } from "lucide-react";
import httpClient from '../../services/httpClient';
import Button from '../../components/ui/Button';
import Field, { Input } from '../../components/ui/Field';
import { mascaraCnpj } from '../../utils/mascaras';

export default function Contact() {
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    nomeEmpresa: '',
    cnpj: '',
    nomeAdmin: '',
    email: '',
    senha: '',
    confirmacaoSenha: ''
  });
  
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: name === 'cnpj' ? mascaraCnpj(value) : value });
  };
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErro('');
    if (formData.senha !== formData.confirmacaoSenha) {
      setErro('A confirmação da senha não confere.');
      return;
    }
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
    <section className="bg-surface py-1" id="contato">
      <div className="max-w-7xl mx-auto px-6">
        <div className="bg-brand-fill rounded-card p-10 md:p-20 relative overflow-hidden shadow-raised">
          
          <div className="pointer-events-none absolute -left-24 -top-24 h-64 w-64 rounded-full bg-ink-inverse/10 blur-3xl"></div>
          <div className="pointer-events-none absolute -bottom-24 -right-24 h-64 w-64 rounded-full bg-ink/10 blur-3xl"></div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center relative z-10">
            
            <div className="text-left text-brand-foreground">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-ink/20 bg-ink/10 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-brand-foreground">
                <Sparkles size={14} aria-hidden="true" /> Cadastro da empresa
              </div>
              <h2 className="text-4xl md:text-5xl font-black leading-tight mb-8">
                Crie a conta da sua empresa.
              </h2>
              
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="rounded-card bg-ink/10 p-3 text-brand-foreground">
                    <Zap size={24} />
                  </div>
                  <p className="font-bold text-lg text-brand-foreground">Folha em lote com desconto de INSS e holerite por colaborador.</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="rounded-card bg-ink/10 p-3 text-brand-foreground">
                    <ShieldCheck size={24} />
                  </div>
                  <p className="font-bold text-lg text-brand-foreground">Acesso separado por perfil e sessão protegida.</p>
                </div>
              </div>
            </div>

            <div className="bg-surface rounded-card p-8 md:p-10 shadow-raised">
              <form className="space-y-4" onSubmit={handleSubmit}>

                {erro && <div role="alert" className="p-4 bg-danger-soft text-danger rounded-card font-semibold text-sm border border-danger-line">{erro}</div>}
                {sucesso && <div role="status" className="p-4 bg-success-soft text-success rounded-card font-semibold text-sm border border-success-line">Conta criada com sucesso! Redirecionando...</div>}

                <Field label="Nome completo" name="nomeAdmin" required>
                  <Input type="text" autoComplete="name" value={formData.nomeAdmin} onChange={handleChange} placeholder="Ex: João Silva" />
                </Field>
                <Field label="Nome da empresa" name="nomeEmpresa" required>
                  <Input type="text" autoComplete="organization" value={formData.nomeEmpresa} onChange={handleChange} placeholder="Sua empresa" />
                </Field>
                <Field label="CNPJ da empresa" name="cnpj" required>
                  <Input type="text" inputMode="numeric" autoComplete="off" value={formData.cnpj} onChange={handleChange} placeholder="00.000.000/0000-00" />
                </Field>
                <Field label="E-mail corporativo" name="email" required>
                  <Input type="email" autoComplete="email" value={formData.email} onChange={handleChange} placeholder="email@empresa.com" />
                </Field>
                <Field label="Senha de acesso" name="senha" required>
                  <Input type="password" autoComplete="new-password" value={formData.senha} onChange={handleChange} placeholder="••••••••" />
                </Field>
                <Field label="Confirme a senha" name="confirmacaoSenha" required>
                  <Input type="password" autoComplete="new-password" value={formData.confirmacaoSenha} onChange={handleChange} placeholder="••••••••" />
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