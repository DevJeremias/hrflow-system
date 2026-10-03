import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { CONSULTA_DESKTOP, ID_DO_MENU } from './menu';
import Header from './Header';
import { useMediaQuery } from '../hooks/useMediaQuery';

const Layout: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  // Sem matchMedia (jsdom, SSR) vale desktop: a gaveta só existe abaixo de lg.
  const desktop = useMediaQuery(CONSULTA_DESKTOP, true);
  const gavetaAberta = isSidebarOpen && !desktop;

  return (
    <div className="flex h-screen w-full overflow-hidden bg-surface-muted">
      <a
        href="#conteudo"
        inert={gavetaAberta}
        className="sr-only rounded-control bg-brand px-4 py-2 text-sm font-semibold text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70]"
      >
        Ir para o conteúdo
      </a>

      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      <div inert={gavetaAberta} className="relative flex flex-1 flex-col overflow-hidden">
        <Header menuAberto={gavetaAberta} menuId={ID_DO_MENU} onOpenSidebar={() => setIsSidebarOpen(true)} />

        <main id="conteudo" tabIndex={-1} className="flex-1 overflow-y-auto p-4 focus:outline-none sm:p-6 lg:p-10">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
