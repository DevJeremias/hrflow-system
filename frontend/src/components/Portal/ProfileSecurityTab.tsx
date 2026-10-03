import React, { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { userService } from '../../services/userService';
import { useAuth } from '../../contexts/AuthContext';
import { HttpError } from '../../services/httpClient';
import { mensagemDeErro } from '../../utils/erros';
import { mensagemDeLimite } from '../../utils/espera';
import ErrorAlert from '../ErrorAlert';
import Button from '../ui/Button';
import Field, { Input } from '../ui/Field';

// A troca de senha derruba a sessão no servidor; o aviso explica a volta ao login.
const AVISO_SENHA_ALTERADA = 'Senha alterada. Entre novamente.';

const ProfileSecurityTab: React.FC = () => {
  const [senhas, setSenhas] = useState({ atual: '', nova: '', confirmacao: '' });
  const [status, setStatus] = useState({ loading: false, erro: '' });
  const { logout } = useAuth();

  const handleTrocarSenha = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus({ loading: true, erro: '' });
    if (senhas.nova !== senhas.confirmacao) return setStatus({ loading: false, erro: 'As senhas não coincidem.' });

    try {
      await userService.changeMyPassword(senhas.atual, senhas.nova);
    } catch (error) {
      const mensagem = mensagemDeErro(error, 'Erro ao alterar senha');
      const erro = error instanceof HttpError && error.status === 429 ? mensagemDeLimite(error.data, mensagem) : mensagem;
      return setStatus({ loading: false, erro });
    }
    await logout(AVISO_SENHA_ALTERADA);
  };

  return (
    <div className="max-w-2xl animate-in fade-in duration-300">
      <h2 className="mb-6 flex items-center gap-2 text-xl font-bold text-ink">
        <ShieldCheck aria-hidden="true" className="text-success" /> Alteração de Senha
      </h2>

      {status.erro && <div className="mb-6"><ErrorAlert message={status.erro} /></div>}

      <form onSubmit={handleTrocarSenha} className="space-y-5">
        <Field label="Senha atual" name="senhaAtual" required>
          <Input type="password" autoComplete="current-password" value={senhas.atual} onChange={e => setSenhas({ ...senhas, atual: e.target.value })} />
        </Field>
        <Field label="Nova senha" name="novaSenha" required>
          <Input type="password" autoComplete="new-password" value={senhas.nova} onChange={e => setSenhas({ ...senhas, nova: e.target.value })} />
        </Field>
        <Field label="Confirmar nova senha" name="confirmacaoSenha" required>
          <Input type="password" autoComplete="new-password" value={senhas.confirmacao} onChange={e => setSenhas({ ...senhas, confirmacao: e.target.value })} />
        </Field>
        <Button type="submit" size="lg" loading={status.loading}>Atualizar Senha</Button>
      </form>
    </div>
  );
};

export default ProfileSecurityTab;
