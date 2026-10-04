import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle2, Lock } from 'lucide-react';
import { recuperacaoDeSenhaService } from '../../services/recuperacaoDeSenhaService';
import { HttpError } from '../../services/httpClient';
import { mensagemDeErro } from '../../utils/erros';
import { mensagemDeLimite } from '../../utils/espera';
import ErrorAlert from '../../components/ErrorAlert';
import CartaoDeAcesso from '../../components/Auth/CartaoDeAcesso';
import Button from '../../components/ui/Button';
import Field, { Input } from '../../components/ui/Field';
import { usePageTitle } from '../../hooks/usePageTitle';

const LINK_SEM_TOKEN = 'Este link de redefinição está incompleto. Peça um novo.';

// O token chega no fragmento do endereço (/redefinir-senha#token=...), que o navegador não envia ao
// servidor nem ao Referer. Ele é lido uma vez e o fragmento sai da barra de endereço.
const RedefinirSenha: React.FC = () => {
  usePageTitle('Redefinir a senha');
  const { hash, pathname } = useLocation();
  const navigate = useNavigate();
  const [token] = useState(() => new URLSearchParams(hash.replace(/^#/, '')).get('token'));
  const [senhas, setSenhas] = useState({ nova: '', confirmacao: '' });
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [concluida, setConcluida] = useState(false);

  useEffect(() => {
    if (hash) navigate(pathname, { replace: true });
  }, [hash, pathname, navigate]);

  const alterar = (campo: keyof typeof senhas) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setSenhas((atuais) => ({ ...atuais, [campo]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (enviando || !token) return;
    setErro('');
    if (senhas.nova !== senhas.confirmacao) return setErro('As senhas não coincidem.');

    setEnviando(true);
    try {
      await recuperacaoDeSenhaService.redefinirSenha(token, senhas.nova);
      setConcluida(true);
    } catch (error) {
      const mensagem = mensagemDeErro(error, 'Erro ao redefinir a senha.');
      setErro(error instanceof HttpError && error.status === 429 ? mensagemDeLimite(error.data, mensagem) : mensagem);
    } finally {
      setEnviando(false);
    }
  };

  if (concluida) {
    return (
      <CartaoDeAcesso>
        <h1 className="mb-6 text-2xl font-bold tracking-tight text-ink sm:text-3xl">Senha redefinida</h1>
        <div role="status" className="mb-8 flex items-start gap-3 rounded-control border border-success-line bg-success-soft p-4 text-sm font-semibold text-success">
          <CheckCircle2 size={20} aria-hidden="true" className="mt-0.5 shrink-0" />
          <p>Pronto! Entre no HRFlow com a nova senha. As outras sessões abertas foram encerradas.</p>
        </div>
        <Button fullWidth size="lg" onClick={() => navigate('/login', { replace: true })}>Ir para o login</Button>
      </CartaoDeAcesso>
    );
  }

  return (
    <CartaoDeAcesso>
      <h1 className="mb-2 text-2xl font-bold tracking-tight text-ink sm:text-3xl">Escolha a nova senha</h1>

      {token === null ? (
        <div className="space-y-6">
          <ErrorAlert message={LINK_SEM_TOKEN} />
          <Link to="/esqueci-senha" className="text-sm font-semibold text-brand underline underline-offset-4 hover:text-brand-hover">Pedir um novo link</Link>
        </div>
      ) : (
        <>
          <p className="mb-8 text-ink-muted">Use pelo menos 8 caracteres. Depois de salvar, você entra com ela.</p>
          <form onSubmit={handleSubmit} className="space-y-5">
            <Field label="Nova senha" name="novaSenha" required>
              <Input data-autofocus type="password" autoComplete="new-password" minLength={8} icon={<Lock size={20} />} value={senhas.nova} onChange={alterar('nova')} />
            </Field>
            <Field label="Confirmar nova senha" name="confirmacao" required>
              <Input type="password" autoComplete="new-password" icon={<Lock size={20} />} value={senhas.confirmacao} onChange={alterar('confirmacao')} />
            </Field>

            {erro && <ErrorAlert message={erro} />}

            <Button type="submit" size="lg" fullWidth loading={enviando}>
              {enviando ? 'Salvando...' : 'Salvar a nova senha'}
            </Button>
          </form>
          {erro && /inválido ou expirou/.test(erro) && (
            <Link to="/esqueci-senha" className="mt-6 inline-block text-sm font-semibold text-brand underline underline-offset-4 hover:text-brand-hover">Pedir um novo link</Link>
          )}
        </>
      )}
    </CartaoDeAcesso>
  );
};

export default RedefinirSenha;
