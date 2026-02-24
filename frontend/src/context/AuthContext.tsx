import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import client from '../api/client';

export interface AuthUser {
  id: string;
  userCode: string | null;
  firstName: string;
  lastName: string | null;
  email: string;
  role: 'ADMIN' | 'SALES' | 'MANAGEMENT';
  isFirstLogin: boolean;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const savedToken = localStorage.getItem('auth_token');
    const savedUser = localStorage.getItem('auth_user');
    if (savedToken && savedUser) { setToken(savedToken); setUser(JSON.parse(savedUser)); }
    setIsLoading(false);
  }, []);

  const login = async (identifier: string, password: string) => {
    const res = await client.post('/api/auth/login', { identifier, password });
    const { token: t, user: u } = res.data;
    localStorage.setItem('auth_token', t);
    localStorage.setItem('auth_user', JSON.stringify(u));
    setToken(t); setUser(u);
  };

  const logout = () => {
    localStorage.removeItem('auth_token'); localStorage.removeItem('auth_user');
    setToken(null); setUser(null); window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
