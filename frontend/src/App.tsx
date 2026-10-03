import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { Perfil, ROTA_TROCA_DE_SENHA, destinoDoLogin, rotaInicial, temAreaPessoal } from './utils/sessao';
import { solicitacoesAtivas } from './utils/recursos';
import ErrorAlert from './components/ErrorAlert';
import Spinner from './components/ui/Spinner';
import Button from './components/ui/Button';
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
const EsqueciSenha = lazy(() => import('./pages/Auth/EsqueciSenha'));
const RedefinirSenha = lazy(() => import('./pages/Auth/RedefinirSenha'));
const Layout = lazy(() => import('./layouts/Layout'));
const Dashboard = lazy(() => import('./pages/Admin/Dashboard'));
const Employees = lazy(() => import('./pages/Admin/Employees'));
const DepartmentsRoles = lazy(() => import('./pages/Admin/OrgStructure'));
const Payroll = lazy(() => import('./pages/Admin/Payroll'));
const Users = lazy(() => import('./pages/Admin/Users'));
const Company = lazy(() => import('./pages/Admin/Company'));
const Approvals = lazy(() => import('./pages/Admin/Approvals'));
const Audit = lazy(() => import('./pages/Admin/Audit'));
const TimeTracking = lazy(() => import('./pages/Admin/TimeTracking'));
const Reports = lazy(() => import('./pages/Admin/Reports'));
const EmployeeHome = lazy(() => import('./pages/Portal/EmployeeDashboard'));
const Payslips = lazy(() => import('./pages/Portal/Payslips'));
const Requests = lazy(() => import('./pages/Portal/Requests'));
const Profile = lazy(() => import('./pages/Portal/Profile'));

// A sessão é confirmada no servidor antes de decidir entre a tela e o login: sem isto a tela ficaria em branco.
const SessionLoading = () => (
  <div role="status" className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface-muted text-brand">
    <Spinner size="lg" decorativo />
    <p className="text-sm font-semibold text-ink-muted">Verificando sua sessão...</p>
  </div>
);

// `trocaDeSenha` marca a única rota de quem entrou com senha provisória: ela leva todas as outras
// para si, e quem não tem senha provisória não tem o que fazer nela. `allowedRoles` restringe por
// perfil; `personalArea` deixa passar quem tem cadastro de funcionário (ponto e holerite próprios) em
// qualquer perfil.
export const ProtectedRoute = ({ children, allowedRoles, personalArea = false, trocaDeSenha = false }: { children: React.ReactNode, allowedRoles?: readonly Perfil[], personalArea?: boolean, trocaDeSenha?: boolean }) => {
  const { isAuthenticated, user, loading, sessionError, retrySession, logout } = useAuth();
  const location = useLocation();

  if (loading) return <SessionLoading />;

  // O servidor não recusou a sessão, só não foi possível confirmá-la: não é motivo para deslogar.
  if (sessionError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-muted p-6">
        <div className="w-full max-w-md space-y-4">
          <ErrorAlert message={sessionError} onRetry={retrySession} />
          <Button variant="link" onClick={() => logout()} className="text-sm text-ink-muted hover:text-ink">
            Sair e entrar novamente
          </Button>
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

  if (personalArea && !temAreaPessoal(user)) {
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
          <Route path="/esqueci-senha" element={<EsqueciSenha />} />
          <Route path="/redefinir-senha" element={<RedefinirSenha />} />
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
            <Route path="aprovacoes" element={<Approvals />} />
            <Route path="auditoria" element={<Audit />} />
            <Route path="estrutura" element={<ProtectedRoute allowedRoles={['Administrador']}><DepartmentsRoles /></ProtectedRoute>} />
            <Route path="folha" element={<Payroll />} />
            <Route path="empresa" element={<Company />} />
            <Route path="gestao-ponto" element={<TimeTracking />} />
            <Route path="relatorios" element={<Reports />} />
            <Route path="usuarios" element={<ProtectedRoute allowedRoles={['Administrador']}><Users /></ProtectedRoute>} />
            <Route path="perfil" element={<Profile />} />
            <Route path="*" element={<NotFound />} />
          </Route>

          {/* ÁREA PESSOAL: ponto e holerite de quem tem cadastro de funcionário, em qualquer perfil */}
          <Route
            path="/meu-painel"
            element={
              <ProtectedRoute personalArea>
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
