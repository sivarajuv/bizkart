import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import axios from 'axios';
import api from '../services/api';

const AuthContext = createContext(null);

// Use env variable if set, otherwise proxy (dev) or same-origin (prod)
const API_BASE = process.env.REACT_APP_API_URL
  ? `${process.env.REACT_APP_API_URL}/api`
  : '/api';

export const AuthProvider = ({ children }) => {
  const [user, setUser]       = useState(null);
  const [token, setToken]     = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore session from localStorage on mount — validate token expiry client-side
  useEffect(() => {
    const savedToken = localStorage.getItem('kk_token');
    const savedUser  = localStorage.getItem('kk_user');

    const clearSession = () => {
      localStorage.removeItem('kk_token');
      localStorage.removeItem('kk_user');
      delete axios.defaults.headers.common.Authorization;
      delete api.defaults.headers.common.Authorization;
      setLoading(false);
    };

    if (!savedToken || !savedUser) { setLoading(false); return; }

    // Decode JWT payload and check expiry — no server round-trip needed
    try {
      const payload = JSON.parse(atob(savedToken.split('.')[1]));
      if (!payload.exp || payload.exp * 1000 < Date.now()) {
        clearSession(); return;
      }
    } catch {
      clearSession(); return;
    }

    let parsedUser = null;
    try { parsedUser = JSON.parse(savedUser); } catch { clearSession(); return; }
    if (!parsedUser) { clearSession(); return; }

    // Token is valid and not expired — restore session
    setToken(savedToken);
    setUser(parsedUser);
    axios.defaults.headers.common.Authorization = `Bearer ${savedToken}`;
    api.defaults.headers.common.Authorization   = `Bearer ${savedToken}`;
    if (parsedUser?.shop?.defaultLanguage) {
      localStorage.setItem('kk_language', parsedUser.shop.defaultLanguage);
    }
    setLoading(false);
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('kk_token');
    localStorage.removeItem('kk_user');
    delete axios.defaults.headers.common.Authorization;
    delete api.defaults.headers.common.Authorization;
    window.location.href = '/';
  }, []);

  // Auto-logout on 401 — but ONLY for requests that were actually sent with the
  // admin/staff bearer token. Shop/customer-portal requests (public browsing,
  // customer login, customer JWT) use a different token (bk_customer_token) or
  // no token at all, and must never trigger an admin-session redirect to '/'.
  // (Previously this matched ANY 401 from the shared axios instance, excluding
  // only urls containing the literal substring '/auth/login' — which missed
  // '/api/customer-auth/login' entirely and force-redirected shop/customer
  // users to the landing page on a simple wrong-password 401.)
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        const sentAuthHeader =
          error.config?.headers?.Authorization || error.config?.headers?.common?.Authorization;
        const adminToken = localStorage.getItem('kk_token');
        const wasAdminAuthedRequest = !!adminToken && sentAuthHeader === `Bearer ${adminToken}`;
        if (error.response?.status === 401 && wasAdminAuthedRequest) {
          logout();
        }
        return Promise.reject(error);
      }
    );
    return () => axios.interceptors.response.eject(interceptor);
  }, [logout]);

  const login = async (shopCode, username, password) => {
    console.log('[BizKart] Login attempt →', { shopCode: shopCode || null, username, url: `${API_BASE}/auth/login` });

    const response = await axios.post(`${API_BASE}/auth/login`, {
      shopCode: shopCode || null,
      username,
      password,
    });

    const { token: authToken, user: authUser } = response.data;
    setToken(authToken);
    setUser(authUser);
    localStorage.setItem('kk_token', authToken);
    localStorage.setItem('kk_user', JSON.stringify(authUser));
    axios.defaults.headers.common.Authorization = `Bearer ${authToken}`;
    api.defaults.headers.common.Authorization   = `Bearer ${authToken}`;
    if (authUser?.shop?.defaultLanguage) {
      localStorage.setItem('kk_language', authUser.shop.defaultLanguage);
    }
    console.log('[BizKart] Login success →', authUser?.role, authUser?.shop?.name);
    return authUser;
  };

  const isSuperAdmin      = () => user?.role === 'SUPER_ADMIN';
  const isAdmin           = () => user?.role === 'ADMIN';
  const isManager         = () => user?.role === 'MANAGER';
  const isCashier         = () => user?.role === 'CASHIER';
  const hasFullShopAccess = () => isSuperAdmin() || isAdmin() || isManager();
  const canManageCatalog  = () => hasFullShopAccess();
  const canViewBusinessInsights = () => isAdmin() || isManager();

  return (
    <AuthContext.Provider value={{
      user, token, loading,
      login, logout,
      isSuperAdmin, isAdmin, isManager, isCashier,
      hasFullShopAccess, canManageCatalog, canViewBusinessInsights,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
