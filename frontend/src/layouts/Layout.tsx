import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header'; 

const Layout: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Mobile
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false); // Desktop (Novo)

  return (
    <div className="flex h-screen w-full bg-slate-50 overflow-hidden font-sans">
      <Sidebar 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)} 
        isCollapsed={isSidebarCollapsed}
      />
      <div className="flex-1 flex flex-col overflow-hidden relative transition-all duration-300">
        <Header 
          onOpenSidebar={() => setIsSidebarOpen(true)} 
          onToggleDesktop={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        />
        <main className="flex-1 overflow-y-auto p-6 md:p-8 lg:p-12">
          <div className="max-w-[1600px] mx-auto">
            <Outlet /> 
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;