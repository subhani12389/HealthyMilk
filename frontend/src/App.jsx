import React, { Component, lazy, Suspense, useEffect, useState, useCallback } from 'react';
import { useAuth } from './context/AuthContext';
import { useToast } from './context/ToastContext';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import AuthPage from './pages/AuthPage';
import { SkeletonBanner, SkeletonStatGrid, SkeletonCard } from './components/Skeleton';
import { AlertCircle, X } from 'lucide-react';

// Code Splitting & Dynamic Imports for Fast Startup
const FarmerDashboard = lazy(() => import('./pages/FarmerDashboard'));
const ConsumerDashboard = lazy(() => import('./pages/ConsumerDashboard'));
const DeliveryDashboard = lazy(() => import('./pages/DeliveryDashboard'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));

function DashboardFallback() {
  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
      <SkeletonBanner />
      <SkeletonStatGrid count={4} />
      <div className="grid-responsive-2">
        <SkeletonCard height="320px" />
        <SkeletonCard height="320px" />
      </div>
    </div>
  );
}

// Error Boundary Component to prevent white screens
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Dashboard Render Error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--accent-rose)' }}>
          <h2>Something went wrong displaying this dashboard.</h2>
          <p style={{ marginTop: '0.5rem', color: 'var(--text-muted)' }}>{this.state.error?.toString()}</p>
          <button 
            onClick={() => { localStorage.clear(); window.location.reload(); }}
            className="btn-primary" 
            style={{ margin: '1.5rem auto 0' }}
          >
            Reset Session & Return to Login
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Normalize role strings across variations
function normalizeRole(role) {
  if (!role) return 'consumer';
  const low = role.toString().toLowerCase().trim();
  if (low === 'admin') return 'admin';
  if (low === 'farmer' || low.includes('farm')) return 'farmer';
  if (low === 'delivery_agent' || low === 'agent' || low === 'delivery' || low.includes('agent')) return 'delivery_agent';
  return 'consumer';
}

// Inspect browser location (path, hash, query params) to detect targeted dashboard role
function getTargetRoleFromLocation() {
  const path = (window.location.pathname + window.location.hash).toLowerCase();
  const searchParams = new URLSearchParams(window.location.search);
  const queryParamRole = (
    searchParams.get('role') || 
    searchParams.get('view') || 
    searchParams.get('dashboard') || 
    searchParams.get('portal') || 
    ''
  ).toLowerCase();

  const matchRole = (str) => {
    if (!str) return null;
    if (str.includes('admin')) return 'admin';
    if (str.includes('farmer') || str.includes('farm')) return 'farmer';
    if (str.includes('agent') || str.includes('delivery')) return 'delivery_agent';
    if (str.includes('consumer') || str.includes('customer')) return 'consumer';
    return null;
  };

  const pathRole = matchRole(path);
  if (pathRole) return pathRole;

  const queryRole = matchRole(queryParamRole);
  if (queryRole) return queryRole;

  return null;
}

export default function App() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [accessDeniedMsg, setAccessDeniedMsg] = useState('');

  const assignedRole = user ? normalizeRole(user.role) : null;

  // Route & URL Permission Guard
  const verifyRoutePermissions = useCallback(() => {
    if (!user) return;

    const requestedRole = getTargetRoleFromLocation();
    if (requestedRole && requestedRole !== assignedRole) {
      // User attempted to access an unauthorized dashboard route
      const deniedText = "You don't have permission to access this page.";
      setAccessDeniedMsg(deniedText);
      showToast(deniedText, 'error');

      // Clean browser URL back to root without page reload or infinite loop
      window.history.replaceState(null, '', '/');
    }
  }, [user, assignedRole, showToast]);

  useEffect(() => {
    verifyRoutePermissions();
    window.addEventListener('popstate', verifyRoutePermissions);
    return () => window.removeEventListener('popstate', verifyRoutePermissions);
  }, [verifyRoutePermissions]);

  if (!user) {
    return <AuthPage />;
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)', overflowX: 'hidden' }}>
      {/* Top Navbar */}
      <Navbar />

      {/* Main Layout Body */}
      <div style={{ display: 'flex', flex: 1, width: '100%', maxWidth: '100%', overflowX: 'hidden' }}>
        {/* Sidebar Navigation */}
        <Sidebar />

        {/* Content Viewport */}
        <main style={{ 
          flex: 1, 
          padding: 'clamp(0.85rem, 2vw, 1.75rem)', 
          overflowY: 'auto', 
          overflowX: 'hidden',
          width: '100%',
          maxWidth: '100%',
          boxSizing: 'border-box'
        }}>
          {/* Access Denied Feedback Banner if unauthorized URL was attempted */}
          {accessDeniedMsg && (
            <div 
              role="alert"
              style={{
                background: 'var(--accent-rose-light)',
                border: '1px solid var(--accent-rose)',
                color: 'var(--accent-rose)',
                padding: '0.85rem 1.25rem',
                borderRadius: '12px',
                marginBottom: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontWeight: 600,
                fontSize: '0.9rem',
                boxShadow: 'var(--shadow-sm)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <AlertCircle size={20} style={{ flexShrink: 0 }} />
                <span>{accessDeniedMsg}</span>
              </div>
              <button
                onClick={() => setAccessDeniedMsg('')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent-rose)',
                  cursor: 'pointer',
                  fontWeight: 700,
                  padding: '4px 8px',
                  borderRadius: '6px'
                }}
                aria-label="Dismiss alert"
              >
                <X size={16} />
              </button>
            </div>
          )}

          <ErrorBoundary>
            <Suspense fallback={<DashboardFallback />}>
              {assignedRole === 'admin' && <AdminDashboard />}
              {assignedRole === 'farmer' && <FarmerDashboard />}
              {assignedRole === 'consumer' && <ConsumerDashboard />}
              {assignedRole === 'delivery_agent' && <DeliveryDashboard />}
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
