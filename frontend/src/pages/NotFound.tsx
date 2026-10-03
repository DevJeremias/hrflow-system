import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { rotaInicial } from '../utils/sessao';
import { classesDoBotao } from '../components/ui/buttonStyles';
import { usePageTitle } from '../hooks/usePageTitle';

// Rota que não existe: quem está logado volta ao próprio painel, quem não está, ao início.
const NotFound: React.FC = () => {
  usePageTitle('Página não encontrada');
  const { user } = useAuth();
  const destino = user ? rotaInicial(user.role) : '/';

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <p aria-hidden="true" className="text-7xl font-extrabold tracking-tighter text-line-strong">404</p>
      <h1 className="text-2xl font-bold text-ink">Página não encontrada</h1>
      <p className="max-w-md text-ink-muted">O endereço que você abriu não existe ou foi movido.</p>
      <Link to={destino} className={`mt-2 ${classesDoBotao('primary', 'lg')}`}>
        {user ? 'Voltar ao painel' : 'Voltar ao início'}
      </Link>
    </div>
  );
};

export default NotFound;
