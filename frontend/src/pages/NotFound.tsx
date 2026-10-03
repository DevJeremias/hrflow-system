import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { rotaInicial } from '../utils/sessao';

// Rota que não existe: quem está logado volta ao próprio painel, quem não está, ao início.
const NotFound: React.FC = () => {
  const { user } = useAuth();
  const destino = user ? rotaInicial(user.role) : '/';

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-7xl font-black tracking-tighter text-slate-200">404</p>
      <h1 className="text-2xl font-black text-slate-900">Página não encontrada</h1>
      <p className="max-w-md font-medium text-slate-500">O endereço que você abriu não existe ou foi movido.</p>
      <Link to={destino} className="mt-2 rounded-2xl bg-slate-900 px-6 py-3 font-bold text-white transition-colors hover:bg-primary">
        {user ? 'Voltar ao painel' : 'Voltar ao início'}
      </Link>
    </div>
  );
};

export default NotFound;
