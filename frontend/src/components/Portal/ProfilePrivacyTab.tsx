import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldHalf } from 'lucide-react';
import type { PerfilUsuario } from '../../services/userService';

interface Props {
  perfil: PerfilUsuario;
}

// O que a pessoa pode pedir sobre os próprios dados e a quem: a empresa é a controladora, e o encarregado que
// ela indicou (Dados da Empresa) é o canal. A política completa fica em /privacidade.
const ProfilePrivacyTab: React.FC<Props> = ({ perfil }) => (
  <div className="max-w-2xl space-y-6 animate-in fade-in duration-300">
    <h2 className="flex items-center gap-2 text-xl font-bold text-ink">
      <ShieldHalf aria-hidden="true" className="text-brand" /> Privacidade e seus dados
    </h2>

    <p className="text-ink-muted">
      A sua empresa decide quais dados seus ficam no HRFlow e para quê. A LGPD garante que você peça a confirmação do
      tratamento, uma cópia dos seus dados, a correção deles e, ao deixar a empresa, a anonimização.
    </p>

    <section aria-labelledby="encarregado-titulo" className="rounded-card bg-surface-muted p-5">
      <h3 id="encarregado-titulo" className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-muted">Encarregado pelo tratamento de dados</h3>
      {perfil.encarregado ? (
        <p className="font-semibold text-ink">
          {perfil.encarregado.nome}
          <br />
          <a href={`mailto:${perfil.encarregado.email}`} className="break-all font-bold text-brand underline underline-offset-2 hover:text-brand-hover">{perfil.encarregado.email}</a>
        </p>
      ) : (
        <p className="text-sm text-ink-muted">A sua empresa ainda não indicou um encarregado. Enquanto isso, fale com o RH.</p>
      )}
    </section>

    <ul className="list-disc space-y-2 pl-5 text-sm text-ink-muted">
      <li>Nome, e-mail, endereço e dados bancários você corrige pedindo a alteração em "Meus Dados"; o RH aprova.</li>
      <li>Para receber uma cópia dos seus dados, ou pedir a anonimização depois de deixar a empresa, procure o RH ou o encarregado.</li>
    </ul>

    <p className="text-sm text-ink-muted">
      Leia a <Link to="/privacidade" className="font-bold text-brand underline underline-offset-2 hover:text-brand-hover">Política de Privacidade</Link> completa.
    </p>
  </div>
);

export default ProfilePrivacyTab;
