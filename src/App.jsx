import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ToastProvider } from './components/ui/Toast';
import { isAuthenticated } from './lib/auth';
import { Layout } from './components/Layout';

// Login and Dashboard stay in the main bundle — they are the first paint on
// every session, so splitting them would only add a round trip.
import Login     from './pages/Login';
import Dashboard from './pages/Dashboard';

// Everything else is fetched on first visit. TemplateForm, BlogEditor and
// UserDetail alone are ~2,800 lines that most sessions never open.
const Analytics          = lazy(() => import('./pages/Analytics'));
const Templates          = lazy(() => import('./pages/Templates'));
const TemplateForm       = lazy(() => import('./pages/TemplateForm'));
const Users              = lazy(() => import('./pages/Users'));
const UserDetail         = lazy(() => import('./pages/UserDetail'));
const Transactions       = lazy(() => import('./pages/Transactions'));
const TransactionDetail  = lazy(() => import('./pages/TransactionDetail'));
const Coupons            = lazy(() => import('./pages/Coupons'));
const Tickets            = lazy(() => import('./pages/Tickets'));
const TicketDetail       = lazy(() => import('./pages/TicketDetail'));
const Assets             = lazy(() => import('./pages/Assets'));
const Reviews            = lazy(() => import('./pages/Reviews'));
const BlogPosts          = lazy(() => import('./pages/BlogPosts'));
const BlogEditor         = lazy(() => import('./pages/BlogEditor'));
const Testing            = lazy(() => import('./pages/Testing'));

function ProtectedRoute({ children }) {
  const location = useLocation();
  if (isAuthenticated()) return children;
  // Preserve the page the admin was heading to so login can return there.
  const next = location.pathname + location.search;
  return <Navigate to={next && next !== '/' ? `/?next=${encodeURIComponent(next)}` : '/'} replace />;
}

/** Shown only while a route chunk downloads — keeps the shell on screen. */
function RouteFallback() {
  return <div className="spinner-wrap"><div className="spinner" /></div>;
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
            <Route path="analytics"              element={<Suspense fallback={<RouteFallback />}><Analytics /></Suspense>} />
            <Route path="templates"              element={<Suspense fallback={<RouteFallback />}><Templates /></Suspense>} />
            <Route path="templates/new"          element={<Suspense fallback={<RouteFallback />}><TemplateForm /></Suspense>} />
            <Route path="templates/:id/edit"     element={<Suspense fallback={<RouteFallback />}><TemplateForm /></Suspense>} />
            <Route path="assets"                 element={<Suspense fallback={<RouteFallback />}><Assets /></Suspense>} />
            <Route path="users"                  element={<Suspense fallback={<RouteFallback />}><Users /></Suspense>} />
            <Route path="users/:id"              element={<Suspense fallback={<RouteFallback />}><UserDetail /></Suspense>} />
            <Route path="transactions"           element={<Suspense fallback={<RouteFallback />}><Transactions /></Suspense>} />
            <Route path="transactions/:id"       element={<Suspense fallback={<RouteFallback />}><TransactionDetail /></Suspense>} />
            <Route path="coupons"                element={<Suspense fallback={<RouteFallback />}><Coupons /></Suspense>} />
            <Route path="tickets"                element={<Suspense fallback={<RouteFallback />}><Tickets /></Suspense>} />
            <Route path="tickets/:id"            element={<Suspense fallback={<RouteFallback />}><TicketDetail /></Suspense>} />
            <Route path="reviews"                element={<Suspense fallback={<RouteFallback />}><Reviews /></Suspense>} />
            <Route path="blog"                   element={<Suspense fallback={<RouteFallback />}><BlogPosts /></Suspense>} />
            <Route path="blog/new"               element={<Suspense fallback={<RouteFallback />}><BlogEditor /></Suspense>} />
            <Route path="blog/:id/edit"          element={<Suspense fallback={<RouteFallback />}><BlogEditor /></Suspense>} />
            <Route path="testing"                element={<Suspense fallback={<RouteFallback />}><Testing /></Suspense>} />
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}
