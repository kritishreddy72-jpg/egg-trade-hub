import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export async function parseResponse(res) {
  const text = await res.text();
  let data;

  try {
    data = JSON.parse(text);
  } catch (err) {
    // Diagnose non-JSON responses (HTML error pages, Vercel SSO, server crash)
    if (
      text.includes('Sign in to Vercel') ||
      text.includes('SAML SSO') ||
      text.includes('dpl_') ||
      text.includes('Vercel Authentication')
    ) {
      throw new Error(
        'Vercel Deployment Protection is ACTIVE. To fix: Open Vercel Dashboard -> Settings -> Deployment Protection and disable "Vercel Authentication".'
      );
    }

    if (res.status === 404) {
      throw new Error(
        'Backend API route not found (404). Check vercel.json rewrites and ensure the backend service is deployed and active.'
      );
    }

    if (res.status >= 500) {
      throw new Error(
        `Backend server error (${res.status}). Check Vercel Function logs and ensure required environment variables (TURSO_DATABASE_URL, JWT_SECRET) are configured.`
      );
    }

    throw new Error(
      `Received non-JSON response from server (Status ${res.status}): ${text.slice(0, 100).replace(/\s+/g, ' ')}...`
    );
  }

  // If the server returned an error status with JSON payload
  if (!res.ok) {
    const errorMsg = (data && (data.error || data.message)) || `Server responded with status ${res.status}`;
    throw new Error(errorMsg);
  }

  return data;
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
