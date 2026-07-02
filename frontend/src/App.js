import React, { useEffect, useState } from 'react';
import { CartProvider } from './context/CartContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import Dashboard from './pages/Dashboard';
import POS from './pages/POS';
import Products from './pages/Products';
import Reports from './pages/Reports';
import AIAssistant from './pages/AIAssistant';
import Users from './pages/Users';
import Login from './pages/Login';
import OnlineOrders from './pages/OnlineOrders';
import DeliveryDashboard from './pages/DeliveryDashboard';
import { authAPI, onlineOrderAPI } from './services/api';
import {
  DEFAULT_LANGUAGE,
  DEFAULT_PLATFORM_SUBTITLE,
  PASSWORD_MIN_LENGTH,
  USER_ROLES,
} from './constants/appConstants';
import { PASSWORD_MESSAGES } from './constants/messages';
import './App.css';

const NAV_ADMIN = [
  { id: 'dashboard',     labelKey: 'dashboard',     icon: 'DB' },
  { id: 'pos',           labelKey: 'pointOfSale',   icon: 'PO' },
  { id: 'online-orders', labelKey: 'onlineOrders',  icon: '📦' },
  { id: 'delivery',      labelKey: 'deliveryBoard', icon: '🛵' },
  { id: 'products',      labelKey: 'products',      icon: 'PR' },
  { id: 'reports',       labelKey: 'reports',       icon: 'RP' },
  { id: 'ai',            labelKey: 'aiAssistant',   icon: 'AI' },
  { id: 'users',         labelKey: 'users',         icon: 'US' },
];

const NAV_SUPER_ADMIN = [
  { id: 'users',    labelKey: 'users',       icon: 'US' },
  { id: 'products', labelKey: 'products',    icon: 'PR' },
  { id: 'ai',       labelKey: 'aiAssistant', icon: 'AI' },
];

const NAV_CASHIER = [
  { id: 'pos',           labelKey: 'pointOfSale',  icon: 'PO' },
  { id: 'online-orders', labelKey: 'onlineOrders', icon: '📦' },
  { id: 'products',      labelKey: 'products',     icon: 'PR' },
];

function ChangePasswordModal({ onClose }) {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [saving, setSaving] = useState(false);
  const updateField = (field, value) => setForm((c) => ({ ...c, [field]: value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.currentPassword || !form.newPassword || !form.confirmPassword) { alert(PASSWORD_MESSAGES.REQUIRED_FIELDS); return; }
    if (form.newPassword.length < PASSWORD_MIN_LENGTH) { alert(PASSWORD_MESSAGES.MIN_LENGTH); return; }
    if (form.newPassword !== form.confirmPassword) { alert(PASSWORD_MESSAGES.MISMATCH); return; }
    setSaving(true);
    try {
      await authAPI.changePassword({ currentPassword: form.currentPassword, newPassword: form.newPassword });
      alert(PASSWORD_MESSAGES.SUCCESS);
      onClose();
    } catch (error) {
      alert(error?.response?.data?.error || error?.response?.data?.message || error.message || PASSWORD_MESSAGES.FAILURE);
    } finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-compact" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="modal-title modal-title-no-margin">Change Password</div>
            <div className="modal-subtitle">Update your sign-in password for this account.</div>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">x</button>
        </div>
        <form onSubmit={handleSubmit} className="form-grid">
          {[['currentPassword','Current Password','current-password'],['newPassword','New Password','new-password'],['confirmPassword','Confirm Password','new-password']].map(([f,l,ac]) => (
            <div key={f} className="form-group span-2">
              <label className="form-label">{l}</label>
              <input className="form-input" type="password" value={form[f]} onChange={(e) => updateField(f, e.target.value)} autoComplete={ac} disabled={saving} />
            </div>
          ))}
          <div className="modal-actions span-2">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Update Password'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AppShell() {
  const { user, loading, logout, isSuperAdmin, hasFullShopAccess } = useAuth();
  const { language, setLanguage, languages, t } = useLanguage();
  const [page, setPage] = useState('dashboard');
  const [showProfile, setShowProfile] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [isMobileNav, setIsMobileNav] = useState(window.innerWidth <= 960);
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 960);
  const [newOrderBadge, setNewOrderBadge] = useState(0);

  const nav = isSuperAdmin() ? NAV_SUPER_ADMIN : hasFullShopAccess() ? NAV_ADMIN : NAV_CASHIER;

  useEffect(() => { setPage(nav[0]?.id || 'pos'); }, [user?.role]);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 960;
      setIsMobileNav(mobile);
      setSidebarOpen(!mobile);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Poll for new online orders badge
  useEffect(() => {
    if (!user || isSuperAdmin()) return;
    const poll = async () => {
      try {
        // Routed through the shared `api` axios instance (respects REACT_APP_API_URL
        // and attaches the auth header) instead of a raw relative fetch(), so this
        // still resolves correctly inside a native (Capacitor) app shell.
        const res = await onlineOrderAPI.getActive();
        setNewOrderBadge(res.data.filter(o => o.status === 'PLACED').length);
      } catch {}
    };
    poll();
    const interval = setInterval(poll, 60000);
    return () => clearInterval(interval);
  }, [user]);

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: '#f7f8f5' }}>
        <div className="loading-dots"><span /><span /><span /></div>
      </div>
    );
  }

  if (!user) return <Login />;

  const allowedPages = nav.map((item) => item.id);
  const activePage = allowedPages.includes(page) ? page : nav[0].id;

  const openPage = (nextPage) => {
    setPage(nextPage);
    if (nextPage === 'online-orders') setNewOrderBadge(0);
    if (isMobileNav) setSidebarOpen(false);
  };

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard':     return <Dashboard onNavigate={openPage} />;
      case 'pos':           return <POS />;
      case 'online-orders': return <OnlineOrders />;
      case 'delivery':      return <DeliveryDashboard />;
      case 'products':      return <Products />;
      case 'reports':       return <Reports />;
      case 'ai':            return <AIAssistant />;
      case 'users':         return <Users />;
      default:              return <POS />;
    }
  };

  const roleBadgeColor = user.role === USER_ROLES.SUPER_ADMIN ? '#22a05e' : user.role === USER_ROLES.ADMIN ? '#f4a823' : user.role === USER_ROLES.MANAGER ? '#f59e0b' : '#3b82f6';
  const roleInitials   = user.role === USER_ROLES.SUPER_ADMIN ? 'SA' : user.role === USER_ROLES.ADMIN ? 'AD' : user.role === USER_ROLES.MANAGER ? 'MG' : 'CA';

  return (
    <CartProvider>
      <div className="app">
        {isMobileNav && sidebarOpen && <button className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} aria-label="Close navigation" />}

        <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
          <div className="sidebar-brand">
            <span className="brand-icon">BK</span>
            <div>
              <div className="brand-name">BizKart</div>
              <div className="brand-sub">{user?.shop?.businessType || user?.shop?.name || DEFAULT_PLATFORM_SUBTITLE}</div>
            </div>
          </div>

          <nav className="sidebar-nav">
            {nav.map((item) => (
              <button
                key={item.id}
                className={`nav-item ${activePage === item.id ? 'active' : ''}`}
                onClick={() => openPage(item.id)}
                style={{ position: 'relative' }}
              >
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-label">{t(item.labelKey) || item.labelKey}</span>
                {item.id === 'online-orders' && newOrderBadge > 0 && (
                  <span style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', background:'#ef4444', color:'#fff', borderRadius:'50%', width:18, height:18, fontSize:10, fontWeight:800, display:'flex', alignItems:'center', justifyContent:'center' }}>
                    {newOrderBadge}
                  </span>
                )}
              </button>
            ))}
          </nav>

          <div style={{ padding: '12px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', borderRadius:10, cursor:'pointer', background: showProfile ? 'rgba(255,255,255,0.06)' : 'transparent' }}
              onClick={() => setShowProfile((v) => !v)}>
              <div style={{ width:34, height:34, borderRadius:'50%', background:roleBadgeColor, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700 }}>{roleInitials}</div>
              <div style={{ flex:1, overflow:'hidden' }}>
                <div style={{ color:'#fff', fontSize:13, fontWeight:600, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{user.fullName}</div>
                <div style={{ color:'#a8c5b5', fontSize:11 }}>{user.role}</div>
              </div>
              <span style={{ color:'#a8c5b5', fontSize:12 }}>{showProfile ? '^' : 'v'}</span>
            </div>
            {showProfile && (
              <div style={{ padding:'8px 12px', background:'rgba(255,255,255,0.04)', borderRadius:10, marginTop:6 }}>
                <div style={{ color:'#fff', fontSize:12, marginBottom:4 }}>{user?.shop?.name}</div>
                <div style={{ color:'#a8c5b5', fontSize:12, marginBottom:8 }}>@{user.username}</div>
                <div style={{ color:'#a8c5b5', fontSize:11, marginBottom:12 }}>{user.email}</div>
                <button onClick={() => { setShowProfile(false); setShowChangePassword(true); }}
                  style={{ width:'100%', padding:'8px', borderRadius:8, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.08)', color:'#fff', cursor:'pointer', fontSize:13, fontWeight:500, fontFamily:"'DM Sans', sans-serif", marginBottom:8 }}>
                  Change Password
                </button>
                <button onClick={logout}
                  style={{ width:'100%', padding:'8px', borderRadius:8, background:'rgba(239,68,68,0.15)', border:'1px solid rgba(239,68,68,0.3)', color:'#fca5a5', cursor:'pointer', fontSize:13, fontWeight:500, fontFamily:"'DM Sans', sans-serif" }}>
                  {t('signOut')}
                </button>
              </div>
            )}
          </div>
        </aside>

        <main className="main-content">
          <div className="topbar">
            <div className="topbar-left">
              {isMobileNav && (
                <button className="mobile-nav-toggle" onClick={() => setSidebarOpen((c) => !c)} aria-label="Toggle navigation">Menu</button>
              )}
              <div>
                <div style={{ fontWeight:700 }}>{user?.shop?.name}</div>
                <div style={{ fontSize:12, color:'var(--text-muted)' }}>{user?.shop?.code} {user?.shop?.businessType ? `• ${user.shop.businessType}` : ''}</div>
              </div>
            </div>
            <div className="topbar-actions">
              <label style={{ fontSize:12, color:'var(--text-muted)' }}>{t('language')}</label>
              <select className="form-select" style={{ width:130 }} value={language} onChange={(e) => setLanguage(e.target.value)}>
                {languages.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}
              </select>
              <span style={{ background: user.role===USER_ROLES.SUPER_ADMIN?'#dcfce7':user.role===USER_ROLES.ADMIN?'#fef3c7':user.role===USER_ROLES.MANAGER?'#ffedd5':'#dbeafe', color: user.role===USER_ROLES.SUPER_ADMIN?'#166534':user.role===USER_ROLES.ADMIN?'#92400e':user.role===USER_ROLES.MANAGER?'#9a3412':'#1e40af', borderRadius:4, padding:'2px 10px', fontSize:12, fontWeight:600 }}>
                {user.role}
              </span>
            </div>
          </div>
          {renderPage()}
        </main>
      </div>
      {showChangePassword && <ChangePasswordModal onClose={() => setShowChangePassword(false)} />}
    </CartProvider>
  );
}

function AppProviders() {
  const { user } = useAuth();
  return (
    <LanguageProvider preferredLanguage={user?.shop?.defaultLanguage || DEFAULT_LANGUAGE}>
      <AppShell />
    </LanguageProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppProviders />
    </AuthProvider>
  );
}
