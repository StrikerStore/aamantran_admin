import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './components/ui/Toast';
import { isAuthenticated } from './lib/auth';
import { Layout } from './components/Layout';

import Login            from './pages/Login';
import Dashboard        from './pages/Dashboard';
import Templates        from './pages/Templates';
import TemplateForm     from './pages/TemplateForm';
import Users            from './pages/Users';
import UserDetail       from './pages/UserDetail';
import Transactions     from './pages/Transactions';
import TransactionDetail from './pages/TransactionDetail';
import Coupons          from './pages/Coupons';
import Tickets          from './pages/Tickets';
import TicketDetail     from './pages/TicketDetail';
import Assets           from './pages/Assets';

function ProtectedRoute({ children }) {
  return isAuthenticated() ? children : <Navigate to="/" replace />;
}

export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Login />} />

          <Route path="/" element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }>
            <Route path="dashboard"              element={<Dashboard />} />
            <Route path="templates"              element={<Templates />} />
            <Route path="templates/new"          element={<TemplateForm />} />
            <Route path="templates/:id/edit"     element={<TemplateForm />} />
            <Route path="assets"                 element={<Assets />} />
            <Route path="users"                  element={<Users />} />
            <Route path="users/:id"              element={<UserDetail />} />
            <Route path="transactions"           element={<Transactions />} />
            <Route path="transactions/:id"       element={<TransactionDetail />} />
            <Route path="coupons"                element={<Coupons />} />
            <Route path="tickets"                element={<Tickets />} />
            <Route path="tickets/:id"            element={<TicketDetail />} />
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}
