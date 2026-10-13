import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';

const AuthContext = createContext();

// Helper to decode JWT token payload safely in browser
function decodeTokenRole(token) {
  if (!token || typeof token !== 'string') return null;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const jsonStr = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const parsed = JSON.parse(jsonStr);
    let role = parsed.role;
    if (role === 'agent' || role === 'delivery') role = 'delivery_agent';
    return role || null;
  } catch (e) {
    return null;
  }
}

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => {
    return localStorage.getItem('healthymilk_token') || null;
  });

  const [user, setUser] = useState(() => {
    const savedUserStr = localStorage.getItem('healthymilk_user');
    const savedToken = localStorage.getItem('healthymilk_token');
    if (savedUserStr && savedToken) {
      try {
        const parsed = JSON.parse(savedUserStr);
        // Cryptographically verify role against signed JWT payload to block client storage tampering
        const tokenRole = decodeTokenRole(savedToken);
        if (tokenRole) {
          parsed.role = tokenRole;
        }
        return parsed;
      } catch (e) {
        return null;
      }
    }
    return null;
  });

  const [activeTab, setActiveTab] = useState('status');
  const [initializing, setInitializing] = useState(false);

  // Refresh user profile session from server on initial load in background
  const refreshUserProfile = async () => {
    const curToken = localStorage.getItem('healthymilk_token');
    if (curToken) {
      try {
        const data = await apiFetch('/api/auth/me', { noCache: true });
        if (data && data.success && data.user) {
          setUser(data.user);
          localStorage.setItem('healthymilk_user', JSON.stringify(data.user));
        } else {
          // If server rejects token or session is invalid, clear session
          logoutUser();
        }
      } catch (err) {
        if (err && (err.status === 401 || err.status === 403)) {
          logoutUser();
        }
      }
    }
  };

  useEffect(() => {
    refreshUserProfile();
  }, []);

  const loginUser = (userData, authToken) => {
    // Normalise role
    const normalizedRole = userData.role === 'agent' ? 'delivery_agent' : userData.role;
    const cleanUser = { ...userData, role: normalizedRole };
    setUser(cleanUser);
    setToken(authToken);
    setActiveTab('status');
    localStorage.setItem('healthymilk_user', JSON.stringify(cleanUser));
    localStorage.setItem('healthymilk_token', authToken);
  };

  const logoutUser = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('healthymilk_user');
    localStorage.removeItem('healthymilk_token');
  };

  // Up-to-date Balance Sync
  const updateUserBalance = (newBalance) => {
    if (user) {
      const updatedUser = { ...user, balance: newBalance };
      setUser(updatedUser);
      localStorage.setItem('healthymilk_user', JSON.stringify(updatedUser));
    }
  };

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const toggleMobileSidebar = () => {
    setMobileSidebarOpen(prev => !prev);
  };

  return (
    <AuthContext.Provider value={{
      user,
      token,
      loginUser,
      logoutUser,
      updateUserBalance,
      refreshUserProfile,
      activeTab,
      setActiveTab,
      mobileSidebarOpen,
      setMobileSidebarOpen,
      toggleMobileSidebar,
      initializing
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
