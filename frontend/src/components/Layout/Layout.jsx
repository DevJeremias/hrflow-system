import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import './Layout.css';

const Layout = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  useEffect(() => {
    const handleResize = () => setIsSidebarOpen(window.innerWidth >= 1024);
    window.addEventListener('resize', handleResize);
    handleResize(); 
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  return (
    <div className="admin-container">
      <Sidebar isOpen={isSidebarOpen} />

      <div className={`main-wrapper ${isSidebarOpen ? 'shifted' : 'full'}`}>
        <Header isOpen={isSidebarOpen} toggleSidebar={toggleSidebar} />

        <main className="main-content">
          {children}
        </main>
      </div>

      {isSidebarOpen && window.innerWidth < 1024 && (
        <div className="overlay" onClick={() => setIsSidebarOpen(false)}></div>
      )}
    </div>
  );
};

export default Layout;