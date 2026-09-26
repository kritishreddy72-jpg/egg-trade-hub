import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

async function parseResponse(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch (err) {
    if (text.includes('Sign in to Vercel') || text.includes('SAML SSO') || text.includes('dpl_')) {
      throw new Error('Vercel Deployment Protection is active. In your Vercel Dashboard, go to Settings > Deployment Protection and turn OFF "Vercel Authentication".');
    }
    if (!res.ok) {
      throw new Error(`Server returned status ${res.status}: Backend service not responding.`);
    }
    throw new Error('Received non-JSON response from server.');
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('egg_trade_token') || null);
  const [loading, setLoading] = useState(true);

  // Check current session on mount
  useEffect(() => {
    async function checkAuth() {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const res = await fetch('/api/auth/me', {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        if (res.ok) {
          const data = await parseResponse(res);
          setUser(data.user);
        } else {
          // Token expired or invalid
          localStorage.removeItem('egg_trade_token');
          setToken(null);
          setUser(null);
        }
      } catch (err) {
        console.error('Auth verification failed:', err);
      } finally {
        setLoading(false);
      }
    }
    checkAuth();
  }, [token]);

  const login = async (identifier, password, role) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password, role })
    });

    const data = await parseResponse(res);
    if (!res.ok) {
      throw new Error(data.error || 'Login failed');
    }

    localStorage.setItem('egg_trade_token', data.token);
    setToken(data.token);
    setUser(data.user);
    return data.user;
  };

  const register = async (userData) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });

    const data = await parseResponse(res);
    if (!res.ok) {
      throw new Error(data.error || 'Registration failed');
    }

    localStorage.setItem('egg_trade_token', data.token);
    setToken(data.token);
    setUser(data.user);
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem('egg_trade_token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
