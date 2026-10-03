import React from 'react';
import ConfirmProvider from './ConfirmProvider';
import ToastProvider from './Toast';

// Tudo que os componentes de ui/ esperam do contexto: toast e confirmação.
const UiProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ToastProvider>
    <ConfirmProvider>{children}</ConfirmProvider>
  </ToastProvider>
);

export default UiProviders;
