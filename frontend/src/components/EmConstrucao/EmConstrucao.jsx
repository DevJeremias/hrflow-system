import React from 'react';
import Layout from '../Layout/Layout'; 
import { Wrench } from 'lucide-react'; 

export default function EmConstrucao() {
  return (
    <Layout>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '80vh', textAlign: 'center' }}>
        <Wrench size={64} color="#cbd5e1" style={{ marginBottom: '20px' }} />
        <h2 style={{ color: '#1e293b', marginBottom: '10px' }}>Página em Construção</h2>
        <p style={{ color: '#64748b', maxWidth: '400px' }}>
          Esta funcionalidade ainda está sendo desenvolvida pela equipe. Em breve estará disponível!
        </p>
      </div>
    </Layout>
  );
}