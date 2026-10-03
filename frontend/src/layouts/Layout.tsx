import React, { Suspense, useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import PaginaCarregando from '../components/PaginaCarregando';

const Layout: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen w-full bg-slate-50 overflow-hidden font-sans">
      
      <Sidebar 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)} 
      />
      
      <div className="flex-1 flex flex-col overflow-hidden relative">
        
        <Header onOpenSidebar={() => setIsSidebarOpen(true)} />
        
        <main className="flex-1 overflow-y-auto p-6 md:p-8 lg:p-12">
          <div className="max-w-7xl mx-auto">
            {/* O menu e o cabeçalho ficam de pé enquanto o código da tela escolhida chega. */}
            <Suspense fallback={<PaginaCarregando />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
        
      </div>
    </div>
  );
};

export default Layout;