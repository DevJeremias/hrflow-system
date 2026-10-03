import React from 'react';
import { PerfilUsuario } from '../../services/userService';

interface Props {
  perfil: PerfilUsuario;
}

const Item: React.FC<{ rotulo: string; className?: string; children: React.ReactNode }> = ({ rotulo, className = '', children }) => (
  <div className={`rounded-card bg-surface-muted p-4 ${className}`}>
    <dt className="mb-1 text-xs font-semibold uppercase tracking-wider text-ink-muted">{rotulo}</dt>
    <dd className="font-semibold text-ink">{children}</dd>
  </div>
);

const ProfileContractTab: React.FC<Props> = ({ perfil }) => {
  // A API manda a data como AAAA-MM-DD; passar por Date a deslocaria um dia no fuso do navegador.
  const formatarData = (dataString: string | null) => {
    if (!dataString) return '-';
    const [ano, mes, dia] = dataString.slice(0, 10).split('-');
    return `${dia}/${mes}/${ano}`;
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <section aria-labelledby="vinculo-titulo">
        <h2 id="vinculo-titulo" className="mb-6 border-b border-line pb-4 text-xl font-bold text-ink">Vínculo Empregatício</h2>
        <dl className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Item rotulo="Data de Admissão">{formatarData(perfil.data_admissao)}</Item>
          <Item rotulo="Tipo de Contrato">{perfil.tipo_contrato || 'Não informado'}</Item>
          <Item rotulo="Nível Profissional">{perfil.nivel || 'Não definido'}</Item>
        </dl>
      </section>

      <section aria-labelledby="bancarios-titulo">
        <h2 id="bancarios-titulo" className="mb-6 border-b border-line pb-4 text-xl font-bold text-ink">Dados Bancários</h2>
        {perfil.banco ? (
          <dl className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <Item rotulo="Instituição Bancária" className="md:col-span-2">{perfil.banco}</Item>
            <Item rotulo="Agência">{perfil.agencia}</Item>
            <Item rotulo={`Conta (${perfil.tipo_conta || 'Corrente'})`}>{perfil.conta}</Item>
          </dl>
        ) : (
          <p className="rounded-card bg-surface-muted p-6 text-center text-sm font-semibold text-ink-muted">Nenhuma informação bancária registrada.</p>
        )}
      </section>
    </div>
  );
};

export default ProfileContractTab;
