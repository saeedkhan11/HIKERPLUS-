import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import AppShell from './components/AppShell';
import Login from './pages/Login';
import PinSetup from './pages/PinSetup';
import PinVerify from './pages/PinVerify';
import Dashboard from './pages/Dashboard';
import Articles from './pages/Articles';
import RawStock from './pages/RawStock';
import ReadyShoes from './pages/ReadyShoes';
import Production from './pages/Production';
import Purchase from './pages/Purchase';
import Customers from './pages/Customers';
import Suppliers from './pages/Suppliers';
import Invoices from './pages/Invoices';
import NewInvoice from './pages/NewInvoice';
import InvoicePrint from './pages/InvoicePrint';
import Sales from './pages/Sales';
import Payments from './pages/Payments';
import Roznamcha from './pages/Roznamcha';
import Kharcha from './pages/Kharcha';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import RecycleBin from './pages/RecycleBin';
import AuditLogs from './pages/AuditLogs';
import UserManagement from './pages/UserManagement';
import Labour from './pages/Labour';

function RequireAuth({ children }) {
  const { session, loading, isSupabaseConfigured } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-mutedfg">
        Loading…
      </div>
    );
  }

  if (!isSupabaseConfigured) {
    return <Login notConfigured />;
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function RequireAdmin({ children }) {
  const { session, isAdmin, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-mutedfg">
        Loading…
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return children;
}

function RequirePin({ children }) {
  const { hasPin, pinVerified, isAdmin, loading } = useAuth();

  console.log('REQUIRE PIN DEBUG:', { hasPin, isAdmin, pinVerified, loading });
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-mutedfg">
        Loading…
      </div>
    );
  }

  // No PIN has been configured.
  if (!hasPin) {
    // Only an administrator can configure the PIN.
    if (isAdmin) {
      return <Navigate to="/setup-pin" replace />;
    }

    // Normal users cannot create their own PIN.
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg p-6">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
          <h1 className="text-xl font-semibold text-fg">
            PIN Not Configured
          </h1>

          <p className="mt-3 text-sm text-mutedfg">
            Your security PIN has not been configured yet.
            Please contact your administrator.
          </p>
        </div>
      </div>
    );
  }

  // PIN exists but has not been verified in this session.
  if (!pinVerified) {
    return <Navigate to="/verify-pin" replace />;
  }

  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        path="/setup-pin"
        element={
          <RequireAdmin>
            <PinSetup />
          </RequireAdmin>
        }
      />

      <Route
        path="/verify-pin"
        element={
          <RequireAuth>
            <PinVerify />
          </RequireAuth>
        }
      />

      <Route
        path="/invoices/:id/print"
        element={
          <RequireAuth>
            <RequirePin>
              <InvoicePrint />
            </RequirePin>
          </RequireAuth>
        }
      />

      <Route
        element={
          <RequireAuth>
            <RequirePin>
              <AppShell />
            </RequirePin>
          </RequireAuth>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="articles" element={<Articles />} />
        <Route path="raw-stock" element={<RawStock />} />
        <Route path="ready-shoes" element={<ReadyShoes />} />
        <Route path="production" element={<Production />} />
        <Route path="purchase" element={<Purchase />} />
        <Route path="customers" element={<Customers />} />
        <Route path="suppliers" element={<Suppliers />} />
        <Route path="invoices" element={<Invoices />} />
        <Route path="invoices/new" element={<NewInvoice />} />
        <Route path="sales" element={<Sales />} />
        <Route path="payments" element={<Payments />} />
        <Route path="roznamcha" element={<Roznamcha />} />
        <Route path="kharcha" element={<Kharcha />} />
        <Route path="labour" element={<Labour />} />
        <Route path="reports" element={<Reports />} />
        <Route path="settings" element={<Settings />} />
        <Route path="recycle-bin" element={<RecycleBin />} />
        <Route path="audit-logs" element={<AuditLogs />} />
        <Route path="users" element={<UserManagement />} />
      </Route>
    </Routes>
  );
}


