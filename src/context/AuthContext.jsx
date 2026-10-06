import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI, AUTH_EXPIRED_EVENT } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('eventhub_token'));
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    const expire = () => {
      setToken(null);
      setUser(null);
      setAuthError('Your session has expired. Please sign in again.');
    };
    window.addEventListener(AUTH_EXPIRED_EVENT, expire);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, expire);
  }, []);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    authAPI.getMe({ signal: controller.signal }).then(data => {
      if (!controller.signal.aborted && localStorage.getItem('eventhub_token') === token) {
        setUser(data.user);
        setAuthError('');
      }
    }).catch(error => {
      if (controller.signal.aborted) return;
      if (error.status === 401) {
        setToken(null);
        setUser(null);
      } else {
        setAuthError('Unable to verify your session. Please refresh and try again.');
      }
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [token]);

  const acceptSession = (data) => {
    localStorage.setItem('eventhub_token', data.token);
    setToken(data.token);
    setUser(data.user);
    setAuthError('');
    return data;
  };
  const login = async (email, password) => acceptSession(await authAPI.login({ email, password }));
  const register = async (name, email, password, role) => acceptSession(await authAPI.register({ name, email, password, role }));
  const logout = () => {
    localStorage.removeItem('eventhub_token');
    setToken(null);
    setUser(null);
    setAuthError('');
  };
  const value = { user, token, loading, authError, login, register, logout, isAuthenticated: !!user, isOrganizer: user?.role === 'organizer' };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}

export default AuthContext;
