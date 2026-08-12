import React from 'react';
import { useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import AuthPage from './pages/AuthPage';
import FarmerDashboard from './pages/FarmerDashboard';
import ConsumerDashboard from './pages/ConsumerDashboard';
import DeliveryDashboard from './pages/DeliveryDashboard';

export default function App() {
  const { user } = useAuth();

  if (!user) {
    return <AuthPage />;
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)' }}>
      {/* Navbar at top */}
      <Navbar />

      {/* Main Layout Body */}
      <div style={{ display: 'flex', flex: 1 }}>
        {/* Sidebar on left */}
        <Sidebar />

        {/* Content Area on right */}
        <main style={{ flex: 1, padding: '1.75rem', overflowY: 'auto' }}>
          {user.role === 'farmer' && <FarmerDashboard />}
          {user.role === 'consumer' && <ConsumerDashboard />}
          {user.role === 'agent' && <DeliveryDashboard />}
        </main>
      </div>
    </div>
  );
}
