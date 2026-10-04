import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Mail, MailCheck } from 'lucide-react';
import { recuperacaoDeSenhaService } from '../../services/recuperacaoDeSenhaService';
import { HttpError } from '../../services/httpClient';
import { mensagemDeErro } from '../../utils/erros';
import { mensagemDeLimite } from '../../utils/espera';
import ErrorAlert from '../../components/ErrorAlert';
import CartaoDeAcesso from '../../components/Auth/CartaoDeAcesso';
import Button from '../../components/ui/Button';
import Field, { Input } from '../../components/ui/Field';
import { usePageTitle } from '../../hooks/usePageTitle';

// O e-mail com o link de redefinição. A resposta é a mesma exista ou não a conta: a tela confirma o
// pedido sem dizer se o endereço está cadastrado.
const EsqueciSenha: React.FC = () => {
  usePageTitle('Esqueci a senha');
  const [email, setEmail] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [confirmacao, setConfirmacao] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (enviando) return;
    setErro('');
    setEnviando(true);
    try {
      setConfirmacao(await recuperacaoDeSenhaService.pedirRedefinicao(email));
    } catch (error) {
      const mensagem = mensagemDeErro(error, 'Erro ao pedir a redefinição de senha.');
      setErro(error instanceof HttpError && error.status === 429 ? mensagemDeLimite(error.data, mensagem) : mensagem);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <CartaoDeAcesso>
      <h1 className="mb-2 text-2xl font-bold tracking-tight text-ink sm:text-3xl">Esqueceu a senha?</h1>

      {confirmacao ? (
        <div className="space-y-6">
          <div role="status" className="flex items-start gap-3 rounded-control border border-success-line bg-success-soft p-4 text-sm font-semibold text-success">
            <MailCheck size={20} aria-hidden="true" className="mt-0.5 shrink-0" />
            <p>{confirmacao} O link vale por 1 hora e só pode ser usado uma vez.</p>
          </div>
          <p className="text-sm text-ink-muted">Não chegou? Confira a caixa de spam ou peça outro link: o último que você pedir é o que vale.</p>
          <Button variant="secondary" fullWidth onClick={() => setConfirmacao(null)}>Pedir de novo</Button>
        </div>
      ) : (
        <>
          <p className="mb-8 text-ink-muted">Informe o e-mail do seu acesso e enviaremos um link para você escolher uma nova senha.</p>
          <form onSubmit={handleSubmit} className="space-y-5">
            <Field label="E-mail" name="email" required>
              <Input data-autofocus type="email" autoComplete="username" placeholder="exemplo@email.com" icon={<Mail size={20} />} value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>

            {erro && <ErrorAlert message={erro} />}

            <Button type="submit" size="lg" fullWidth loading={enviando}>
              {enviando ? 'Enviando...' : 'Enviar o link'}
            </Button>
          </form>
        </>
      )}

      <Link to="/login" className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-brand underline-offset-4 hover:text-brand-hover hover:underline">
        <ArrowLeft size={16} aria-hidden="true" /> Voltar para o login
      </Link>
    </CartaoDeAcesso>
  );
};

export default EsqueciSenha;
