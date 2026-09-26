import React, { Component, lazy, Suspense } from 'react';
import { useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import AuthPage from './pages/AuthPage';
import { SkeletonBanner, SkeletonStatGrid, SkeletonCard } from './components/Skeleton';

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

export default function App() {
  const { user } = useAuth();

  if (!user) {
    return <AuthPage />;
  }

  const role = (user.role || '').toLowerCase();

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
          <ErrorBoundary>
            <Suspense fallback={<DashboardFallback />}>
              {role === 'admin' && <AdminDashboard />}
              {(role === 'farmer' || role.includes('farm')) && <FarmerDashboard />}
              {(role === 'consumer' || role.includes('sub')) && <ConsumerDashboard />}
              {(role === 'agent' || role === 'delivery' || role.includes('agent')) && <DeliveryDashboard />}
              {!['admin', 'farmer', 'consumer', 'agent', 'delivery'].some(r => role.includes(r)) && <FarmerDashboard />}
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
