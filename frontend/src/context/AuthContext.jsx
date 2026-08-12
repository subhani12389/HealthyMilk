import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('healthymilk_user');
    if (savedUser) {
      try { return JSON.parse(savedUser); } catch (e) { return null; }
    }
    return null; // Start unauthenticated by default
  });

  const [token, setToken] = useState(() => {
    return localStorage.getItem('healthymilk_token') || null;
  });

  const [activeTab, setActiveTab] = useState('status');
  const [initializing, setInitializing] = useState(true);

  // Validate session on app launch if token exists
  useEffect(() => {
    const verifySession = async () => {
      if (token) {
        try {
          const res = await fetch('/api/auth/me', {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const data = await res.json();
          if (data.success && data.user) {
            setUser(data.user);
          } else {
            // Invalid session
            setUser(null);
            setToken(null);
            localStorage.removeItem('healthymilk_user');
            localStorage.removeItem('healthymilk_token');
          }
        } catch (err) {
          console.error('Session verification error:', err);
        }
      }
      setInitializing(false);
    };

    verifySession();
  }, [token]);

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

  return (
    <AuthContext.Provider value={{
      user,
      token,
      loginUser,
      logoutUser,
      activeTab,
      setActiveTab,
      initializing
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
