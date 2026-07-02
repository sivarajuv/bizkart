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
          <AdminShell
            onGoToShop={() => pushRoute('/shop')}
            onLogout={() => pushRoute('/')}
          />
        </CartProvider>
      </LanguageProvider>
    );
  }

  // Landing page — user is null here (not logged in)
  return <LandingPage onNavigate={pushRoute} />;
}

/* ── Landing Page ──────────────────────────────────────────────────────── */
function LandingPage({ onNavigate, autoOpenLogin = false }) {
  const [showLogin, setShowLogin] = useState(autoOpenLogin);

  return (
    <div style={L.page}>
      {/* Header */}
      <div style={L.header}>
        <div style={L.logo}>
          <span style={{ fontSize: 26 }}>🛒</span>
          <span style={L.logoText}>BizKart</span>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button style={L.navBtn}        onClick={() => onNavigate('/shop')}>Order Online</button>
          <button style={L.navBtnPrimary} onClick={() => setShowLogin(true)}>Business Login</button>
        </div>
      </div>

      {/* Hero */}
      <div style={L.hero}>
        <div style={{ flex: '1 1 480px', maxWidth: 560 }}>
          <div style={L.heroTag}>Multi-Business Platform</div>
          <h1 style={L.heroTitle}>Order from Local Stores.<br />Manage Your Business.</h1>
          <p style={L.heroSub}>BizKart connects customers with local shops and gives business owners powerful tools to manage orders, inventory, and delivery — all in one place.</p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button style={L.btnGreen} onClick={() => onNavigate('/shop')}>🛒 Shop Now</button>
            <button style={L.btnWhite} onClick={() => setShowLogin(true)}>🏪 Business Login</button>
          </div>
        </div>

        <div style={{ flex: '0 0 300px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={L.card}>
            <div style={{ fontSize: 30, marginBottom: 10 }}>📱</div>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>Customer App</div>
            <div style={{ fontSize: 13, color: '#888', marginBottom: 16, lineHeight: 1.5 }}>Browse shops, add to cart, choose delivery or pickup, pay & track your order.</div>
            <button style={{ ...L.btnGreen, padding: '10px 20px', fontSize: 13 }} onClick={() => onNavigate('/shop')}>Start Shopping →</button>
          </div>
          <div style={L.card}>
            <div style={{ fontSize: 30, marginBottom: 10 }}>🏪</div>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>Business Dashboard</div>
            <div style={{ fontSize: 13, color: '#888', marginBottom: 16, lineHeight: 1.5 }}>Accept orders, manage inventory, get WhatsApp alerts & view reports.</div>
            <button style={{ ...L.btnWhite, padding: '10px 20px', fontSize: 13 }} onClick={() => setShowLogin(true)}>Admin Login →</button>
          </div>
        </div>
      </div>

      {/* Features */}
      <div style={{ background: '#f9fafb', padding: '60px 32px' }}>
        <h2 style={L.sectionTitle}>Everything you need</h2>
        <div style={L.grid4}>
          {[
            { icon: '🛵', title: 'Home Delivery',      desc: 'Customers order online, you assign a delivery agent.' },
            { icon: '🏪', title: 'Store Pickup',        desc: 'Customers order ahead and collect from the counter.' },
            { icon: '📦', title: 'Live Order Board',    desc: 'Kanban board: New → Preparing → Delivered.' },
            { icon: '📱', title: 'WhatsApp Alerts',     desc: 'Instant WhatsApp message when a new order arrives.' },
            { icon: '💳', title: 'Multiple Payments',   desc: 'COD, UPI QR and Card — customer chooses.' },
            { icon: '📊', title: 'Business Reports',    desc: 'Daily revenue, top products, profit/loss.' },
            { icon: '🤖', title: 'AI Assistant',        desc: 'Ask questions about your business in plain language.' },
            { icon: '🌐', title: 'Multi-Language',      desc: 'English, Hindi, Telugu, Tamil, Kannada and more.' },
          ].map(f => (
            <div key={f.title} style={L.featCard}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>{f.icon}</div>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>{f.title}</div>
              <div style={{ fontSize: 13, color: '#888', lineHeight: 1.5 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* How it works */}
      <div style={{ padding: '60px 32px', maxWidth: 900, margin: '0 auto' }}>
        <h2 style={L.sectionTitle}>How it works</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
          {[
            {
              title: '👤 For Customers',
              steps: ['Register with phone number', 'Browse shops and products', 'Add to cart and checkout', 'Choose delivery or pickup', 'Pay online or cash on delivery', 'Track order in real-time'],
              btn: '🛒 Try it now', action: () => onNavigate('/shop'), primary: true,
            },
            {
              title: '🏪 For Shop Owners',
              steps: ['Login with business code', 'View live incoming orders', 'Accept & prepare the order', 'Assign delivery agent', 'Get WhatsApp notification', 'Track revenue and reports'],
              btn: '🔑 Admin Login', action: () => setShowLogin(true), primary: false,
            },
          ].map(col => (
            <div key={col.title} style={{ background: '#f9fafb', borderRadius: 16, padding: 28, border: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 18 }}>{col.title}</div>
              {col.steps.map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, fontSize: 14 }}>
                  <span style={{ width: 26, height: 26, borderRadius: '50%', background: '#16a34a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, flexShrink: 0 }}>{i + 1}</span>
                  {s}
                </div>
              ))}
              <button style={{ ...(col.primary ? L.btnGreen : L.btnWhite), marginTop: 16 }} onClick={col.action}>{col.btn}</button>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div style={{ background: '#1a1a1a', color: '#fff', padding: '32px', textAlign: 'center' }}>
        <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 16 }}>🛒 BizKart</div>
        <div style={{ display: 'flex', gap: 24, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
          <button onClick={() => onNavigate('/shop')} style={{ color: '#9ca3af', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer' }}>Customer Portal</button>
          <button onClick={() => setShowLogin(true)} style={{ color: '#9ca3af', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer' }}>Admin Panel</button>
          <a href="tel:7259000552"      style={{ color: '#9ca3af', fontSize: 13, textDecoration: 'none' }}>📞 7259000552</a>
          <a href="mailto:siva82k@gmail.com" style={{ color: '#9ca3af', fontSize: 13, textDecoration: 'none' }}>✉ siva82k@gmail.com</a>
        </div>
        <div style={{ fontSize: 12, color: '#6b7280' }}>© 2025 BizKart · Multi-business retail platform</div>
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

/* ── Styles ──────────────────────────────────────────────────────────────── */
const L = {
  page:         { fontFamily: 'system-ui,sans-serif', background: '#fff', minHeight: '100vh' },
  header:       { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 32px', borderBottom: '1px solid #e5e7eb', position: 'sticky', top: 0, background: '#fff', zIndex: 100 },
  logo:         { display: 'flex', alignItems: 'center', gap: 10 },
  logoText:     { fontSize: 22, fontWeight: 800, color: '#1a1a1a' },
  navBtn:       { padding: '8px 20px', border: '1.5px solid #e5e7eb', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: '#374151' },
  navBtnPrimary:{ padding: '8px 20px', border: 'none', borderRadius: 8, background: '#16a34a', cursor: 'pointer', fontSize: 14, fontWeight: 700, color: '#fff' },
  hero:         { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '60px 32px 40px', gap: 40, maxWidth: 1200, margin: '0 auto', flexWrap: 'wrap' },
  heroTag:      { display: 'inline-block', background: '#dcfce7', color: '#16a34a', fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 20, marginBottom: 16 },
  heroTitle:    { fontSize: 42, fontWeight: 800, color: '#1a1a1a', lineHeight: 1.2, margin: '0 0 16px' },
  heroSub:      { fontSize: 16, color: '#6b7280', lineHeight: 1.6, margin: '0 0 28px' },
  btnGreen:     { padding: '13px 28px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer' },
  btnWhite:     { padding: '13px 28px', background: '#fff', color: '#374151', border: '2px solid #e5e7eb', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer' },
  card:         { background: '#f9fafb', borderRadius: 16, padding: 24, border: '1px solid #e5e7eb' },
  sectionTitle: { fontSize: 28, fontWeight: 800, color: '#1a1a1a', marginBottom: 32, textAlign: 'center' },
  grid4:        { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 16, maxWidth: 1100, margin: '0 auto' },
  featCard:     { background: '#fff', borderRadius: 14, padding: '22px 18px', border: '1px solid #e5e7eb' },
};

const M = {
  overlay:   { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 },
  box:       { background: '#fff', borderRadius: 20, padding: 32, width: '100%', maxWidth: 420, boxShadow: '0 24px 60px rgba(0,0,0,0.18)' },
  closeBtn:  { background: '#f3f4f6', border: 'none', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  group:     { marginBottom: 16 },
  label:     { display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 },
  input:     { width: '100%', padding: '11px 14px', border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: 14, outline: 'none', boxSizing: 'border-box', color: '#111', fontFamily: 'system-ui,sans-serif' },
  err:       { background: '#fef2f2', color: '#b91c1c', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 14, border: '1px solid #fecaca' },
  submitBtn: { width: '100%', padding: 14, background: '#16a34a', color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'system-ui,sans-serif' },
};
