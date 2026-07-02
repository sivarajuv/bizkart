/**
 * IntegratedApp.jsx — Single entry point for BizKart
 *
 * Routes (based on URL path):
 *   /       → Landing page (with Business Login modal + Shop Now button)
 *   /shop   → Customer Portal
 *   /admin  → Admin Panel
 *
 * AuthProvider wraps EVERYTHING at the top so user state is never lost.
 */

import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import { CartProvider } from './context/CartContext';
import CustomerPortal from './pages/CustomerPortal';
import AdminShell from './AdminShell';
import PublicShopPage from './pages/PublicShopPage';

/* ── Route helpers ─────────────────────────────────────────────────────── */
function getRoute() {
  const p = window.location.pathname;
  if (p.startsWith('/shop'))   return 'shop';
  if (p.startsWith('/admin'))  return 'admin';
  if (p.startsWith('/portal')) return 'shop';
  if (p.startsWith('/s/'))     return 'public-shop';
  return 'landing';
}

function getPublicShopSlug() {
  const m = window.location.pathname.match(/^\/s\/(.+)/);
  return m ? m[1] : null;
}

function pushRoute(to) {
  window.history.pushState({}, '', to);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

/* ── Top-level: AuthProvider wraps everything ──────────────────────────── */
export default function IntegratedApp() {
  return (
    <AuthProvider>
      <Router />
    </AuthProvider>
  );
}

/* ── Router (inside AuthProvider so useAuth always works) ─────────────── */
function Router() {
  const [route, setRoute] = useState(getRoute());
  const { user, loading } = useAuth();

  useEffect(() => {
    const handler = () => setRoute(getRoute());
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, []);

  // Auto-redirect logged-in user from landing → admin
  useEffect(() => {
    if (user && route === 'landing') pushRoute('/admin');
  }, [user, route]);

  // Wait for auth state to restore from localStorage before rendering
  if (loading) return null;

  if (route === 'public-shop') {
    return <PublicShopPage slug={getPublicShopSlug()} />;
  }

  if (route === 'shop') {
    return <CustomerPortal onBack={() => pushRoute('/')} />;
  }

  if (route === 'admin') {
    // Not logged in → show landing with login modal pre-opened
    if (!user) return <LandingPage onNavigate={pushRoute} autoOpenLogin />;
    return (
      <LanguageProvider preferredLanguage={user?.shop?.defaultLanguage || 'en'}>
        <CartProvider>
          <AdminShell />
        </CartProvider>
      </LanguageProvider>
    );
  }

  // Landing page — user is null here (not logged in)
  return <LandingPage onNavigate={pushRoute} />;
}

/* ── Landing Page ──────────────────────────────────────────────────────────
 * Deliberately minimal: exactly two entry points (customer / business), no
 * marketing scroll. Sized in relative units (%, vw-capped max-widths) so it
 * fits any phone/tablet/desktop without horizontal scroll or clipped content,
 * and centers as a single card rather than a multi-section page. ────────── */
function LandingPage({ onNavigate, autoOpenLogin = false }) {
  const [showLogin, setShowLogin] = useState(autoOpenLogin);

  return (
    <div style={L.page}>
      <div style={L.card}>
        <div style={L.logoRow}>
          <span style={{ fontSize: 40 }}>🛒</span>
          <span style={L.logoText}>BizKart</span>
        </div>
        <p style={L.tagline}>Order from local stores, or manage your own.</p>

        <button style={L.choiceGreen} onClick={() => onNavigate('/shop')}>
          <span style={L.choiceIcon}>🛍️</span>
          <span style={L.choiceText}>
            <span style={L.choiceTitle}>Shop Now</span>
            <span style={L.choiceSub}>Browse & order from local shops</span>
          </span>
          <span style={L.choiceArrow}>›</span>
        </button>

        <button style={L.choiceDark} onClick={() => setShowLogin(true)}>
          <span style={L.choiceIcon}>🏪</span>
          <span style={L.choiceText}>
            <span style={L.choiceTitle}>Business Login</span>
            <span style={L.choiceSub}>Manage orders, inventory & staff</span>
          </span>
          <span style={L.choiceArrow}>›</span>
        </button>

        <div style={L.footer}>
          <a href="tel:7259000552" style={L.footerLink}>📞 7259000552</a>
          <span style={L.footerDot}>·</span>
          <a href="mailto:siva82k@gmail.com" style={L.footerLink}>✉ Support</a>
        </div>
      </div>

      {/* Login modal — uses useAuth internally, safe because we're inside AuthProvider */}
      {showLogin && (
        <LoginModal
          onClose={() => setShowLogin(false)}
          onSuccess={() => { setShowLogin(false); onNavigate('/admin'); }}
        />
      )}
    </div>
  );
}

/* ── Login Modal — safe to call useAuth() here because AuthProvider is at root ── */
function LoginModal({ onClose, onSuccess }) {
  const { login } = useAuth();
  const [shopCode, setShopCode] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr]           = useState('');
  const [loading, setLoading]   = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!username.trim()) { setErr('Username is required'); return; }
    if (!password)        { setErr('Password is required'); return; }
    setErr(''); setLoading(true);
    try {
      const resolvedShopCode = shopCode.trim() || null;
      console.log('[BizKart Login] Sending:', { shopCode: resolvedShopCode, username: username.trim() });
      await login(resolvedShopCode, username.trim(), password);
      onSuccess();
    } catch (ex) {
      console.error('Login error:', ex);
      if (ex?.response) {
        // Server responded with error
        const msg = ex.response.data?.error || ex.response.data?.message || `Server error ${ex.response.status}`;
        setErr(msg);
      } else if (ex?.request) {
        // No response — backend not reachable
        setErr('Cannot reach server. Make sure backend is running on port 8080.');
      } else {
        setErr(ex?.message || 'Login failed. Please try again.');
      }
    }
    setLoading(false);
  };

  // Close on Escape key
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <div style={M.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={M.box}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#1a1a1a' }}>🏪 Business Login</div>
            <div style={{ fontSize: 13, color: '#888', marginTop: 4 }}>Sign in to manage your shop</div>
          </div>
          <button style={M.closeBtn} onClick={onClose}>✕</button>
        </div>

        <form onSubmit={submit}>
          <div style={M.group}>
            <label style={M.label}>
              Business Code&nbsp;
              <span style={{ color: '#888', fontWeight: 400 }}>(leave blank for Super Admin)</span>
            </label>
            <input
              style={M.input}
              placeholder="e.g. slv01"
              value={shopCode}
              onChange={e => setShopCode(e.target.value)}
              autoComplete="off"
            />
          </div>

          <div style={M.group}>
            <label style={M.label}>Username</label>
            <input
              style={M.input}
              placeholder="Enter username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoFocus
              autoComplete="username"
            />
          </div>

          <div style={M.group}>
            <label style={M.label}>Password</label>
            <input
              style={M.input}
              type="password"
              placeholder="Enter password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          {err && (
            <div style={M.err}>{err}</div>
          )}

          <button
            type="submit"
            style={{ ...M.submitBtn, opacity: loading ? 0.7 : 1 }}
            disabled={loading}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <div style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center', marginTop: 14 }}>
          Need access? Call&nbsp;
          <a href="tel:7259000552" style={{ color: '#16a34a', fontWeight: 600 }}>7259000552</a>
        </div>
      </div>
    </div>
  );
}

/* ── Styles ────────────────────────────────────────────────────────────────
 * Landing page is one centered card, sized with relative/clamped units so it
 * never overflows a small phone screen or looks lost on a desktop tab. ───── */
const L = {
  page: {
    fontFamily: 'system-ui,sans-serif',
    minHeight: '100vh',
    background: 'linear-gradient(160deg, #16a34a 0%, #0f2419 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px 16px',
    boxSizing: 'border-box',
  },
  card: {
    width: '100%',
    maxWidth: 380,
    background: '#fff',
    borderRadius: 24,
    padding: '36px 28px 28px',
    boxShadow: '0 24px 60px rgba(0,0,0,0.25)',
    boxSizing: 'border-box',
  },
  logoRow:  { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 },
  logoText: { fontSize: 26, fontWeight: 800, color: '#1a1a1a', fontFamily: "'Syne', system-ui, sans-serif" },
  tagline:  { textAlign: 'center', color: '#6b7280', fontSize: 13.5, margin: '8px 0 28px', lineHeight: 1.5 },

  choiceGreen: {
    width: '100%', display: 'flex', alignItems: 'center', gap: 14,
    padding: '16px 18px', marginBottom: 12, border: 'none', borderRadius: 16,
    background: '#16a34a', color: '#fff', cursor: 'pointer', textAlign: 'left',
    boxSizing: 'border-box',
  },
  choiceDark: {
    width: '100%', display: 'flex', alignItems: 'center', gap: 14,
    padding: '16px 18px', marginBottom: 4, border: 'none', borderRadius: 16,
    background: '#101827', color: '#fff', cursor: 'pointer', textAlign: 'left',
    boxSizing: 'border-box',
  },
  choiceIcon:  { fontSize: 26, flexShrink: 0 },
  choiceText:  { flex: 1, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 },
  choiceTitle: { fontSize: 16, fontWeight: 700 },
  choiceSub:   { fontSize: 12, opacity: 0.8 },
  choiceArrow: { fontSize: 22, opacity: 0.7, flexShrink: 0 },

  footer:     { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 24 },
  footerLink: { color: '#9ca3af', fontSize: 12, textDecoration: 'none' },
  footerDot:  { color: '#d1d5db', fontSize: 12 },
};

const M = {
  overlay:   { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 },
  box:       { background: '#fff', borderRadius: 20, padding: 32, width: '100%', maxWidth: 420, boxShadow: '0 24px 60px rgba(0,0,0,0.18)' },
  closeBtn:  { background: '#f3f4f6', border: 'none', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  group:     { marginBottom: 16 },
  label:     { display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 },
  input:     { width: '100%', padding: '11px 14px', border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: 14, outline: 'none', boxSizing: 'border-box', color: '#111', fontFamily: 'system-ui,sans-serif' },
  err:       { background: '#fef2f2', color: '#b91c1c', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 14, border: '1px solid #fecaca' },
  submitBtn: { width: '100%', padding: 14, background: '#16a34a', color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'system-ui,sans-serif' },
};
