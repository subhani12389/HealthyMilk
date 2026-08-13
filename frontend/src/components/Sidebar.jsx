import React from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Milk, Wallet, Clock, Settings, Calendar, Truck, 
  ShieldCheck, Sparkles 
} from 'lucide-react';

export default function Sidebar() {
  const { user, activeTab, setActiveTab } = useAuth();

  if (!user) return null;

  const formattedBalance = user.balance !== undefined && user.balance !== null
    ? `₹${Number(user.balance).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : '₹0.00';

  const farmerItems = [
    { id: 'status', label: 'Current Milk Status', icon: Milk, badge: 'Today' },
    { id: 'balance', label: 'Account Balance', icon: Wallet, badge: formattedBalance },
    { id: 'history', label: 'Supply History', icon: Clock },
    { id: 'settings', label: 'Settings & Farm Profile', icon: Settings }
  ];

  const consumerItems = [
    { id: 'status', label: 'Current Milk Status', icon: Milk, badge: 'ETA 7:15 AM' },
    { id: 'subscription', label: 'Subscription & Days', icon: Calendar, badge: `${user.subscription?.daysRemaining || 22} Days Left` },
    { id: 'history', label: 'Delivery History', icon: Clock },
    { id: 'settings', label: 'Settings & Address', icon: Settings }
  ];

  const agentItems = [
    { id: 'status', label: 'Dispatch Queue', icon: Truck, badge: 'Active' },
    { id: 'balance', label: 'Account Balance & Fee', icon: Wallet, badge: formattedBalance },
    { id: 'history', label: 'Completed Deliveries', icon: Clock },
    { id: 'settings', label: 'Settings & Route', icon: Settings }
  ];

  const navItems = user.role === 'farmer' ? farmerItems : user.role === 'consumer' ? consumerItems : agentItems;

  return (
    <aside style={{
      width: '265px',
      background: 'var(--bg-card)',
      borderRight: '1px solid var(--border-color)',
      padding: '1.25rem 1rem',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      minHeight: 'calc(100vh - 65px)'
    }}>
      <div>
        {/* User Account Card */}
        <div style={{
          padding: '1rem',
          borderRadius: '14px',
          background: 'var(--bg-glass)',
          border: '1px solid var(--border-color)',
          marginBottom: '1.25rem'
        }}>
          <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>
            Logged in as
          </div>
          <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-main)', marginTop: '2px' }}>
            {user.role === 'farmer' ? (user.farmName || user.name) : user.name}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--accent-emerald)', fontWeight: 600, marginTop: '2px', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <ShieldCheck size={14} /> Verified {user.role.toUpperCase()}
          </div>
        </div>

        {/* Section Title */}
        <div style={{
          fontSize: '0.7rem',
          fontWeight: 700,
          textTransform: 'uppercase',
          color: 'var(--text-muted)',
          padding: '0 0.5rem 0.5rem',
          letterSpacing: '0.05em'
        }}>
          {user.role === 'farmer' ? 'Farmer Dashboard' : user.role === 'consumer' ? 'Consumer Portal' : 'Delivery Agent Portal'}
        </div>

        {/* Navigation Items */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.75rem 0.85rem',
                  borderRadius: '12px',
                  background: isActive ? 'var(--accent-emerald-light)' : 'transparent',
                  color: isActive ? 'var(--accent-emerald)' : 'var(--text-main)',
                  fontWeight: isActive ? 700 : 500,
                  fontSize: '0.88rem',
                  border: isActive ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid transparent',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <Icon size={19} color={isActive ? 'var(--accent-emerald)' : 'var(--text-muted)'} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span 
                    className={`badge ${isActive ? 'badge-success' : 'badge-info'}`} 
                    style={{ 
                      fontSize: '0.68rem', 
                      padding: '2px 6px',
                      fontWeight: 800
                    }}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Quality Banner */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(5, 150, 105, 0.1) 0%, rgba(37, 99, 235, 0.1) 100%)',
        border: '1px solid var(--border-color)',
        borderRadius: '14px',
        padding: '0.85rem',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}>
          <Sparkles size={15} color="var(--accent-emerald)" /> 100% Pure Organic
        </div>
        <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
          Chilled at 4°C directly from farmer to your doorstep.
        </p>
      </div>
    </aside>
  );
}
