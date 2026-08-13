import React, { Component } from 'react';
import { useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import AuthPage from './pages/AuthPage';
import FarmerDashboard from './pages/FarmerDashboard';
import ConsumerDashboard from './pages/ConsumerDashboard';
import DeliveryDashboard from './pages/DeliveryDashboard';

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
  const { user, initializing } = useAuth();

  if (initializing) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)', color: 'var(--text-muted)' }}>
        <p>Initializing HealthyMilk Portal...</p>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  const role = (user.role || '').toLowerCase();

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)' }}>
      {/* Top Navbar */}
      <Navbar />

      {/* Main Layout Body */}
      <div style={{ display: 'flex', flex: 1 }}>
        {/* Sidebar Navigation */}
        <Sidebar />

        {/* Content Viewport */}
        <main style={{ flex: 1, padding: '1.75rem', overflowY: 'auto' }}>
          <ErrorBoundary>
            {(role === 'farmer' || role.includes('farm')) && <FarmerDashboard />}
            {(role === 'consumer' || role.includes('sub')) && <ConsumerDashboard />}
            {(role === 'agent' || role === 'delivery' || role.includes('agent')) && <DeliveryDashboard />}
            {!['farmer', 'consumer', 'agent', 'delivery'].some(r => role.includes(r)) && <FarmerDashboard />}
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
