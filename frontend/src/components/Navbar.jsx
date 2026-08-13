import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { apiFetch } from '../utils/api';
import { 
  Sun, Moon, Bell, User, LogOut, CheckCircle2, AlertCircle, 
  Info, ChevronDown, Milk, ShieldCheck 
} from 'lucide-react';

export default function Navbar() {
  const { user, logoutUser } = useAuth();
  const { theme, toggleTheme, isDark } = useTheme();

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifs, setShowNotifs] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const notifRef = useRef(null);
  const profileRef = useRef(null);

  // Fetch notifications
  const fetchNotifications = async () => {
    if (!user) return;
    try {
      const data = await apiFetch(`/api/notifications?userId=${user.id}`);
      if (data && data.success) {
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (err) {
      console.error('Failed to load notifications:', err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 10000);
    return () => clearInterval(interval);
  }, [user]);

  // Handle click outside dropdowns
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotifs(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const markAllAsRead = async () => {
    try {
      await apiFetch('/api/notifications/mark-read', {
        method: 'POST',
        body: JSON.stringify({ userId: user?.id })
      });
      setUnreadCount(0);
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (err) {
      console.error(err);
    }
  };

  const roleColors = {
    farmer: { bg: 'var(--accent-emerald-light)', text: 'var(--accent-emerald)', label: '🌾 Dairy Farmer' },
    consumer: { bg: 'var(--accent-blue-light)', text: 'var(--accent-blue)', label: '🥛 Consumer' },
    agent: { bg: 'var(--accent-amber-light)', text: 'var(--accent-amber)', label: '🚚 Delivery Agent' }
  };

  const currentRoleConfig = user ? (roleColors[user.role] || roleColors.consumer) : roleColors.consumer;

  return (
    <header style={{
      position: 'sticky',
      top: 0,
      zIndex: 50,
      background: 'var(--bg-glass)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      borderBottom: '1px solid var(--border-color)',
      padding: '0.75rem 1.75rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    }}>
      {/* Brand Logo & Name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <div style={{
          width: '42px',
          height: '42px',
          borderRadius: '12px',
          background: 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#FFFFFF',
          boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
        }}>
          <Milk size={24} />
        </div>
        <div>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            Healthy<span style={{ color: 'var(--accent-emerald)' }}>Milk</span>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Pure Farm-to-Consumer Dairy Network</p>
        </div>
      </div>

      {/* Right Controls: Dark/Light Mode, Notifications, Profile Details */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        
        {/* Dark / Light Mode Toggle Button */}
        <button
          onClick={toggleTheme}
          title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '12px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            color: isDark ? '#F59E0B' : '#475569',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'var(--shadow-sm)',
            transition: 'transform 0.2s ease'
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          {isDark ? <Sun size={20} /> : <Moon size={20} />}
        </button>

        {/* Notifications Popover */}
        {user && (
          <div style={{ position: 'relative' }} ref={notifRef}>
            <button
              onClick={() => setShowNotifs(!showNotifs)}
              title="Notifications"
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-main)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                boxShadow: 'var(--shadow-sm)'
              }}
            >
              <Bell size={20} />
              {unreadCount > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '-4px',
                  right: '-4px',
                  background: 'var(--accent-rose)',
                  color: '#FFFFFF',
                  fontSize: '0.65rem',
                  fontWeight: 800,
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '2px solid var(--bg-card)'
                }}>
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Notifications Drawer */}
            {showNotifs && (
              <div style={{
                position: 'absolute',
                right: 0,
                top: '50px',
                width: '340px',
                maxHeight: '420px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: '16px',
                boxShadow: 'var(--shadow-lg)',
                zIndex: 100,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column'
              }}>
                <div style={{
                  padding: '1rem',
                  borderBottom: '1px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'var(--bg-glass)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Bell size={18} color="var(--accent-emerald)" />
                    <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>Notifications</span>
                    {unreadCount > 0 && (
                      <span className="badge badge-danger" style={{ fontSize: '0.7rem' }}>
                        {unreadCount} new
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button 
                      onClick={markAllAsRead}
                      style={{ fontSize: '0.75rem', color: 'var(--accent-emerald)', background: 'none', fontWeight: 600 }}
                    >
                      Mark all read
                    </button>
                  )}
                </div>

                <div style={{ overflowY: 'auto', flex: 1, padding: '0.5rem' }}>
                  {notifications.length === 0 ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      No notifications yet.
                    </div>
                  ) : (
                    notifications.map(notif => (
                      <div 
                        key={notif.id}
                        style={{
                          padding: '0.75rem',
                          borderRadius: '10px',
                          marginBottom: '0.35rem',
                          background: notif.read ? 'transparent' : 'var(--accent-emerald-light)',
                          borderLeft: notif.read ? '3px solid transparent' : '3px solid var(--accent-emerald)',
                          display: 'flex',
                          gap: '0.75rem',
                          alignItems: 'flex-start'
                        }}
                      >
                        {notif.type === 'success' ? (
                          <CheckCircle2 size={18} color="var(--accent-emerald)" style={{ flexShrink: 0, marginTop: '2px' }} />
                        ) : notif.type === 'warning' ? (
                          <AlertCircle size={18} color="var(--accent-amber)" style={{ flexShrink: 0, marginTop: '2px' }} />
                        ) : (
                          <Info size={18} color="var(--accent-blue)" style={{ flexShrink: 0, marginTop: '2px' }} />
                        )}
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-main)' }}>
                            {notif.title}
                          </div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px', lineHeight: '1.3' }}>
                            {notif.message}
                          </div>
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                            {notif.time}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Profile Details Dropdown */}
        {user ? (
          <div style={{ position: 'relative' }} ref={profileRef}>
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.65rem',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                padding: '0.35rem 0.75rem',
                borderRadius: '12px',
                boxShadow: 'var(--shadow-sm)'
              }}
            >
              <div style={{
                width: '34px',
                height: '34px',
                borderRadius: '50%',
                background: currentRoleConfig.bg,
                color: currentRoleConfig.text,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '0.9rem'
              }}>
                {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
              </div>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 700, fontSize: '0.85rem', lineHeight: '1.2' }}>{user.name}</div>
                <div style={{ fontSize: '0.7rem', color: currentRoleConfig.text, fontWeight: 600 }}>
                  {currentRoleConfig.label}
                </div>
              </div>
              <ChevronDown size={14} color="var(--text-muted)" />
            </button>

            {/* Profile Dropdown Menu */}
            {showProfileMenu && (
              <div style={{
                position: 'absolute',
                right: 0,
                top: '50px',
                width: '240px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: '16px',
                boxShadow: 'var(--shadow-lg)',
                padding: '0.75rem',
                zIndex: 100
              }}>
                <div style={{ padding: '0.5rem 0.5rem 0.75rem', borderBottom: '1px solid var(--border-color)' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{user.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{user.email}</div>
                  <div style={{
                    marginTop: '0.5rem',
                    fontSize: '0.72rem',
                    background: currentRoleConfig.bg,
                    color: currentRoleConfig.text,
                    padding: '3px 8px',
                    borderRadius: '6px',
                    fontWeight: 700,
                    display: 'inline-block'
                  }}>
                    {user.farmName || user.address || user.assignedArea || 'HealthyMilk Member'}
                  </div>
                </div>

                <div style={{ paddingTop: '0.5rem' }}>
                  <button
                    onClick={() => {
                      logoutUser();
                      setShowProfileMenu(false);
                    }}
                    style={{
                      width: '100%',
                      padding: '0.6rem 0.75rem',
                      borderRadius: '8px',
                      background: 'var(--accent-rose-light)',
                      color: 'var(--accent-rose)',
                      fontWeight: 600,
                      fontSize: '0.85rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}
                  >
                    <LogOut size={16} /> Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </header>
  );
}
