import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ToastProvider } from './components/ui/Toast';
import { isAuthenticated } from './lib/auth';
import { Layout } from './components/Layout';

import Login            from './pages/Login';
import Dashboard        from './pages/Dashboard';
import Analytics        from './pages/Analytics';
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
import Reviews          from './pages/Reviews';
import BlogPosts        from './pages/BlogPosts';
import BlogEditor       from './pages/BlogEditor';

function ProtectedRoute({ children }) {
  const location = useLocation();
  if (isAuthenticated()) return children;
  // Preserve the page the admin was heading to so login can return there.
  const next = location.pathname + location.search;
  return <Navigate to={next && next !== '/' ? `/?next=${encodeURIComponent(next)}` : '/'} replace />;
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
            <Route path="analytics"              element={<Analytics />} />
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
            <Route path="reviews"                element={<Reviews />} />
            <Route path="blog"                   element={<BlogPosts />} />
            <Route path="blog/new"               element={<BlogEditor />} />
            <Route path="blog/:id/edit"          element={<BlogEditor />} />
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}
