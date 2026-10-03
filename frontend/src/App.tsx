import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { Perfil, ROTA_TROCA_DE_SENHA, destinoDoLogin, rotaInicial } from './utils/sessao';
import { solicitacoesAtivas } from './utils/recursos';
import ErrorAlert from './components/ErrorAlert';
import PaginaCarregando from './components/PaginaCarregando';
import AvisoDeAtualizacao from './components/AvisoDeAtualizacao';
import NotFound from './pages/NotFound';

// Cada grupo de telas (site público, autenticação, administração e portal do colaborador) vira
// um arquivo próprio: quem abre a landing não baixa o código do painel.
const Landing = lazy(() => import('./pages/Landing/Home'));
const Termos = lazy(() => import('./pages/Legal/Termos'));
const Privacidade = lazy(() => import('./pages/Legal/Privacidade'));
const Login = lazy(() => import('./pages/Auth/Login'));
const TrocarSenha = lazy(() => import('./pages/Auth/TrocarSenha'));
const Layout = lazy(() => import('./layouts/Layout'));
const Dashboard = lazy(() => import('./pages/Admin/Dashboard'));
const Employees = lazy(() => import('./pages/Admin/Employees'));
const DepartmentsRoles = lazy(() => import('./pages/Admin/OrgStructure'));
const Payroll = lazy(() => import('./pages/Admin/Payroll'));
const TimeTracking = lazy(() => import('./pages/Admin/TimeTracking'));
const EmployeeHome = lazy(() => import('./pages/Portal/EmployeeDashboard'));
const Payslips = lazy(() => import('./pages/Portal/Payslips'));
const Requests = lazy(() => import('./pages/Portal/Requests'));
const Profile = lazy(() => import('./pages/Portal/Profile'));

// `trocaDeSenha` marca a única rota de quem entrou com senha provisória: ela leva todas as outras
// para si, e quem não tem senha provisória não tem o que fazer nela.
const ProtectedRoute = ({ children, allowedRoles, trocaDeSenha = false }: { children: React.ReactNode, allowedRoles?: readonly Perfil[], trocaDeSenha?: boolean }) => {
  const { isAuthenticated, user, loading, sessionError, retrySession, logout } = useAuth();
  const location = useLocation();

  if (loading) return null;

  // O servidor não recusou a sessão, só não foi possível confirmá-la: não é motivo para deslogar.
  if (sessionError) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 bg-slate-50">
        <div className="w-full max-w-md space-y-4">
          <ErrorAlert message={sessionError} onRetry={retrySession} />
          <button onClick={() => logout()} className="text-sm font-bold text-slate-500 hover:text-slate-700 underline underline-offset-4">
            Sair e entrar novamente
          </button>
        </div>
      </div>
    );
  }

  // O destino interrompido segue com a pessoa até o login, que a devolve a ele.
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}${location.hash}` }} />;
  }

  if (user.senhaProvisoria && !trocaDeSenha) return <Navigate to={ROTA_TROCA_DE_SENHA} replace />;
  if (!user.senhaProvisoria && trocaDeSenha) return <Navigate to={rotaInicial(user.role)} replace />;

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={rotaInicial(user.role)} replace />;
  }

  return <>{children}</>;
};

// Quem já está logado não tem o que fazer no login.
const PublicLogin = () => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return null;
  if (user) return <Navigate to={destinoDoLogin(location.state, user)} replace />;
  return <Login />;
};

function App() {
  return (
    <>
      <Suspense fallback={<PaginaCarregando />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<PublicLogin />} />
          <Route path="/termos" element={<Termos />} />
          <Route path="/privacidade" element={<Privacidade />} />
          <Route path={ROTA_TROCA_DE_SENHA} element={<ProtectedRoute trocaDeSenha><TrocarSenha /></ProtectedRoute>} />

          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['Administrador', 'RH']}>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="colaboradores" element={<Employees />} />
            <Route path="estrutura" element={<DepartmentsRoles />} />
            <Route path="folha" element={<Payroll />} />
            <Route path="gestao-ponto" element={<TimeTracking />} />
            <Route path="perfil" element={<Profile />} />
            <Route path="*" element={<NotFound />} />
          </Route>

          {/* ÁREA DO COLABORADOR */}
          <Route
            path="/meu-painel"
            element={
              <ProtectedRoute allowedRoles={['Colaborador']}>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<EmployeeHome />} />
            <Route path="holerites" element={<Payslips />} />
            <Route path="solicitacoes" element={solicitacoesAtivas() ? <Requests /> : <Navigate to="/meu-painel" replace />} />
            <Route path="perfil" element={<Profile />} />
            <Route path="*" element={<NotFound />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      <AvisoDeAtualizacao />
    </>
  );
}

export default App;
