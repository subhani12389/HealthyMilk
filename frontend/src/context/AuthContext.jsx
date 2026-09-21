import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('healthymilk_user');
    if (savedUser) {
      try { return JSON.parse(savedUser); } catch (e) { return null; }
    }
    return null;
  });

  const [token, setToken] = useState(() => {
    return localStorage.getItem('healthymilk_token') || null;
  });

  const [activeTab, setActiveTab] = useState('status');
  const [initializing, setInitializing] = useState(true);

  // Refresh user profile session from server on initial load
  const refreshUserProfile = async () => {
    const curToken = localStorage.getItem('healthymilk_token');
    if (curToken) {
      const data = await apiFetch('/api/auth/me');
      if (data.success && data.user) {
        setUser(data.user);
        localStorage.setItem('healthymilk_user', JSON.stringify(data.user));
      }
    }
    setInitializing(false);
  };

  useEffect(() => {
    refreshUserProfile();
  }, []);

  const loginUser = (userData, authToken) => {
    setUser(userData);
    setToken(authToken);
    setActiveTab('status');
    localStorage.setItem('healthymilk_user', JSON.stringify(userData));
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

  const switchRole = (newRole) => {
    if (user) {
      const updatedUser = { ...user, role: newRole };
      setUser(updatedUser);
      localStorage.setItem('healthymilk_user', JSON.stringify(updatedUser));
      setActiveTab('status');
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      token,
      loginUser,
      logoutUser,
      switchRole,
      updateUserBalance,
      refreshUserProfile,
      activeTab,
      setActiveTab,
      initializing
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
