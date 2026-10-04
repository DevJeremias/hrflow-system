import React, { useState } from 'react';
import { Lock, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { userService } from '../../services/userService';
import { HttpError } from '../../services/httpClient';
import { mensagemDeErro } from '../../utils/erros';
import { mensagemDeLimite } from '../../utils/espera';
import ErrorAlert from '../../components/ErrorAlert';
import Button from '../../components/ui/Button';
import Field, { Input } from '../../components/ui/Field';
import { usePageTitle } from '../../hooks/usePageTitle';
import CartaoDeAcesso from '../../components/Auth/CartaoDeAcesso';

// A troca encerra a sessão no servidor; o aviso no login explica a volta.
const AVISO_SENHA_DEFINIDA = 'Senha definida. Entre com a nova senha.';

// Primeira etapa de quem entrou com a senha que o RH definiu ou redefiniu: o servidor só aceita a
// troca (403 no resto), então não há outra tela a mostrar até ela.
const TrocarSenha: React.FC = () => {
  usePageTitle('Defina a sua senha');
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
    <CartaoDeAcesso>
      <h1 className="mb-2 flex items-center gap-2 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
        <ShieldCheck aria-hidden="true" className="shrink-0 text-success" /> Defina a sua senha
      </h1>
      <p className="mb-8 text-ink-muted">
        {user ? `${user.nome}, a` : 'A'} senha que você recebeu é provisória. Escolha uma só sua para continuar.
      </p>

      <form onSubmit={handleSubmit} className="space-y-5">
        <Field label="Senha provisória" name="senhaAtual" required>
          <Input data-autofocus type="password" autoComplete="current-password" icon={<Lock size={20} />} value={senhas.atual} onChange={alterar('atual')} />
        </Field>
        <Field label="Nova senha" name="novaSenha" required hint="Mínimo de 8 caracteres e diferente da senha provisória.">
          <Input type="password" autoComplete="new-password" minLength={8} icon={<Lock size={20} />} value={senhas.nova} onChange={alterar('nova')} />
        </Field>
        <Field label="Confirmar nova senha" name="confirmacao" required>
          <Input type="password" autoComplete="new-password" icon={<Lock size={20} />} value={senhas.confirmacao} onChange={alterar('confirmacao')} />
        </Field>

        {erro && <ErrorAlert message={erro} />}

        <Button type="submit" size="lg" fullWidth loading={enviando}>
          {enviando ? 'Salvando...' : 'Definir senha'}
        </Button>
      </form>

      <Button variant="link" className="mt-6 text-sm text-ink-muted hover:text-ink" onClick={() => logout()}>
        Sair
      </Button>
    </CartaoDeAcesso>
  );
};

export default TrocarSenha;
