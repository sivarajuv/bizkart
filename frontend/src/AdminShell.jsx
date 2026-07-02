/**
 * AdminShell.jsx
 * 
 * Wraps the existing admin panel with:
 *  - Live online order badge in sidebar
 *  - WhatsApp notification panel
 *  - Order count banner on Dashboard
 *  - "View Shop" button to open customer portal
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from './context/AuthContext';
import { useLanguage } from './context/LanguageContext';
import Dashboard from './pages/Dashboard';
import POS from './pages/POS';
import Products from './pages/Products';
import Reports from './pages/Reports';
import AIAssistant from './pages/AIAssistant';
import Users from './pages/Users';
import OnlineOrders from './pages/OnlineOrders';
import DeliveryDashboard from './pages/DeliveryDashboard';
import Coupons from './pages/Coupons';
import CustomerAnalytics from './pages/CustomerAnalytics';
import DynamicPricing from './pages/DynamicPricing';
import SmsMarketing from './pages/SmsMarketing';
import { authAPI, onlineOrderAPI } from './services/api';
import {
  DEFAULT_LANGUAGE, DEFAULT_PLATFORM_SUBTITLE,
  PASSWORD_MIN_LENGTH, USER_ROLES,
} from './constants/appConstants';
import { PASSWORD_MESSAGES } from './constants/messages';

const NAV_ADMIN = [
  { id: 'dashboard',      labelKey: 'dashboard',     icon: '◈' },
  { id: 'pos',            labelKey: 'pointOfSale',   icon: '⊕' },
  { id: 'online-orders',  labelKey: 'onlineOrders',  icon: '📦' },
  { id: 'delivery',       labelKey: 'deliveryBoard', icon: '🛵' },
  { id: 'products',       labelKey: 'products',      icon: '▦'  },
  { id: 'coupons',        labelKey: 'coupons',       icon: '🎁'  },
  { id: 'analytics',     labelKey: 'analytics',     icon: '📊'  },
  { id: 'pricing',       labelKey: 'dynamicPricing',icon: '🏷️'  },
  { id: 'sms',           labelKey: 'smsMarketing',  icon: '📣'  },
  { id: 'reports',       labelKey: 'reports',       icon: '◉'  },
  { id: 'ai',             labelKey: 'aiAssistant',   icon: '✦'  },
  { id: 'users',          labelKey: 'users',         icon: '◑'  },
];
const NAV_SUPER_ADMIN = [
  { id: 'users',    labelKey: 'users',       icon: '◑' },
  { id: 'products', labelKey: 'products',    icon: '▦' },
  { id: 'ai',       labelKey: 'aiAssistant', icon: '✦' },
];
const NAV_CASHIER = [
  { id: 'pos',           labelKey: 'pointOfSale',  icon: '⊕' },
  { id: 'online-orders', labelKey: 'onlineOrders', icon: '📦' },
  { id: 'products',      labelKey: 'products',     icon: '▦'  },
];

// ── WhatsApp Helper ─────────────────────────────────────────────────────────
function buildWhatsAppMessage(order) {
  const lines = [
    `🛒 *New Order Received!*`,
    `Order: ${order.orderNumber}`,
    `Customer: ${order.customerAccount?.name} (${order.customerAccount?.phone})`,
    `Type: ${order.orderType === 'DELIVERY' ? '🛵 Home Delivery' : '🏪 Pickup'}`,
    ``,
    `*Items:*`,
    ...(order.items || []).map(i => `• ${i.productName} x${i.quantity} — ₹${i.subtotal}`),
    ``,
    `*Total: ₹${order.totalAmount}*`,
    `Payment: ${order.paymentMethod}`,
    order.deliveryAddressText ? `Address: ${order.deliveryAddressText}` : '',
    order.customerNotes ? `Note: ${order.customerNotes}` : '',
  ].filter(Boolean);
  return encodeURIComponent(lines.join('\n'));
}

function sendWhatsApp(phone, order) {
  const clean = phone.replace(/\D/g, '');
  const num = clean.startsWith('91') ? clean : '91' + clean;
  const msg = buildWhatsAppMessage(order);
  window.open(`https://wa.me/${num}?text=${msg}`, '_blank');
}

// ── Order Notification Banner ───────────────────────────────────────────────
function OrderNotificationBanner({ orders, shopPhone, onDismiss }) {
  if (!orders || orders.length === 0) return null;
  return (
    <div style={{ background: '#fef3c7', borderBottom: '2px solid #f59e0b', padding: '10px 24px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 20 }}>🔔</span>
      <span style={{ fontWeight: 700, color: '#92400e', fontSize: 14 }}>
        {orders.length} new order{orders.length > 1 ? 's' : ''} waiting!
      </span>
      {orders.slice(0, 3).map(o => (
        <div key={o.id} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 12, background: '#fff', padding: '3px 8px', borderRadius: 6, color: '#374151', border: '1px solid #e5e7eb' }}>
            {o.orderNumber} · ₹{o.totalAmount}
          </span>
          {shopPhone && (
            <button onClick={() => sendWhatsApp(shopPhone, o)}
              style={{ padding: '3px 10px', background: '#25d366', color: '#fff', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
              📱 WhatsApp
            </button>
          )}
        </div>
      ))}
      <button onClick={onDismiss} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#92400e', fontWeight: 700, fontSize: 14 }}>✕</button>
    </div>
  );
}

// ── WhatsApp Settings Modal ─────────────────────────────────────────────────
function WhatsAppModal({ currentPhone, onSave, onClose }) {
  const [phone, setPhone] = useState(currentPhone || '');
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: 360, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 6 }}>📱 WhatsApp Alerts</div>
        <div style={{ fontSize: 13, color: '#888', marginBottom: 20, lineHeight: 1.5 }}>
          Enter the shop owner's WhatsApp number. A message will be sent automatically when a new order arrives.
        </div>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: '#374151' }}>
          WhatsApp Number (with country code)
        </label>
        <input
          style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: 14, boxSizing: 'border-box', marginBottom: 8, color: '#111' }}
          placeholder="e.g. 9876543210"
          value={phone}
          onChange={e => setPhone(e.target.value.replace(/\D/g, ''))}
        />
        <div style={{ fontSize: 11, color: '#888', marginBottom: 18 }}>
          📌 Format: 10-digit Indian number (we'll add +91 automatically)
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose}
            style={{ flex: 1, padding: 10, border: '1px solid #e5e7eb', borderRadius: 8, background: '#f9fafb', cursor: 'pointer', fontWeight: 600 }}>
            Cancel
          </button>
          <button onClick={() => { onSave(phone); onClose(); }}
            style={{ flex: 1, padding: 10, border: 'none', borderRadius: 8, background: '#25d366', color: '#fff', cursor: 'pointer', fontWeight: 700 }}>
            Save & Enable
          </button>
        </div>
        {phone && (
          <button onClick={() => { sendWhatsApp(phone, { orderNumber: 'TEST-001', customerAccount: { name: 'Test Customer', phone: '9999999999' }, orderType: 'DELIVERY', items: [{ productName: 'Test Item', quantity: 1, subtotal: 100 }], totalAmount: 130, paymentMethod: 'COD', deliveryAddressText: '123 Test Street' }); }}
            style={{ width: '100%', marginTop: 10, padding: 10, border: '1px solid #25d366', borderRadius: 8, background: '#f0fdf4', color: '#15803d', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
            📤 Send Test Message
          </button>
        )}
      </div>
    </div>
  );
}

// ── Change Password Modal ───────────────────────────────────────────────────
function ChangePasswordModal({ onClose }) {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.currentPassword || !form.newPassword || !form.confirmPassword) { alert(PASSWORD_MESSAGES.REQUIRED_FIELDS); return; }
    if (form.newPassword.length < PASSWORD_MIN_LENGTH) { alert(PASSWORD_MESSAGES.MIN_LENGTH); return; }
    if (form.newPassword !== form.confirmPassword) { alert(PASSWORD_MESSAGES.MISMATCH); return; }
    setSaving(true);
    try {
      await authAPI.changePassword({ currentPassword: form.currentPassword, newPassword: form.newPassword });
      alert(PASSWORD_MESSAGES.SUCCESS); onClose();
    } catch (e) {
      alert(e?.response?.data?.error || PASSWORD_MESSAGES.FAILURE);
    }
    setSaving(false);
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-compact" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div><div className="modal-title modal-title-no-margin">Change Password</div></div>
          <button type="button" className="modal-close" onClick={onClose}>x</button>
        </div>
        <form onSubmit={handleSubmit} className="form-grid">
          {[['currentPassword', 'Current Password'], ['newPassword', 'New Password'], ['confirmPassword', 'Confirm Password']].map(([f, l]) => (
            <div key={f} className="form-group span-2">
              <label className="form-label">{l}</label>
              <input className="form-input" type="password" value={form[f]} onChange={e => setForm({ ...form, [f]: e.target.value })} disabled={saving} />
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

// ── MAIN ADMIN SHELL ────────────────────────────────────────────────────────
export default function AdminShell({ onGoToShop }) {
  const { user, loading, logout, isSuperAdmin, hasFullShopAccess } = useAuth();
  const { language, setLanguage, languages, t } = useLanguage();
  const [page, setPage] = useState('dashboard');
  const [showProfile, setShowProfile] = useState(false);
  const [showChangePwd, setShowChangePwd] = useState(false);
  const [showWhatsApp, setShowWhatsApp] = useState(false);
  const [isMobileNav, setIsMobileNav] = useState(window.innerWidth <= 960);
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 960);

  // Order notification state
  const [newOrders, setNewOrders] = useState([]);
  const [dismissedIds, setDismissedIds] = useState(new Set());
  const [whatsappPhone, setWhatsappPhone] = useState(() => localStorage.getItem('bk_wa_phone') || '');
  const prevOrderIds = useRef(new Set());
  const audioRef = useRef(null);

  const nav = isSuperAdmin() ? NAV_SUPER_ADMIN : hasFullShopAccess() ? NAV_ADMIN : NAV_CASHIER;

  useEffect(() => { if (nav[0]) setPage(nav[0].id); }, [user?.role]);

  useEffect(() => {
    const r = () => { const m = window.innerWidth <= 960; setIsMobileNav(m); setSidebarOpen(!m); };
    window.addEventListener('resize', r); return () => window.removeEventListener('resize', r);
  }, []);

  // ── Poll for new online orders ─────────────────────────────────────────
  const pollOrders = useCallback(async () => {
    if (!user || isSuperAdmin()) return;
    try {
      const res = await onlineOrderAPI.getActive();
      const placed = (res.data || []).filter(o => o.status === 'PLACED');
      const brandNew = placed.filter(o => !prevOrderIds.current.has(o.id) && !dismissedIds.has(o.id));

      if (brandNew.length > 0) {
        setNewOrders(prev => {
          const existIds = new Set(prev.map(o => o.id));
          return [...prev, ...brandNew.filter(o => !existIds.has(o.id))];
        });

        // Play notification sound
        try { new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAA...').play().catch(() => {}); } catch {}

        // Auto WhatsApp if phone configured
        if (whatsappPhone) {
          brandNew.forEach(o => {
            setTimeout(() => sendWhatsApp(whatsappPhone, o), 500);
          });
        }

        placed.forEach(o => prevOrderIds.current.add(o.id));
      }
    } catch {}
  }, [user, isSuperAdmin, dismissedIds, whatsappPhone]);

  useEffect(() => {
    pollOrders();
    const interval = setInterval(pollOrders, 30000);
    return () => clearInterval(interval);
  }, [pollOrders]);

  const saveWhatsappPhone = (phone) => {
    setWhatsappPhone(phone);
    localStorage.setItem('bk_wa_phone', phone);
  };

  const dismissNotifications = () => {
    setDismissedIds(prev => new Set([...prev, ...newOrders.map(o => o.id)]));
    setNewOrders([]);
  };

  if (loading) return (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>
      <div className="loading-dots"><span /><span /><span /></div>
    </div>
  );

  // If no user, Router in IntegratedApp handles the redirect
  if (!user) return null;

  const allowedPages = nav.map(i => i.id);
  const activePage = allowedPages.includes(page) ? page : nav[0]?.id;

  const openPage = (p) => {
    setPage(p);
    if (p === 'online-orders') setNewOrders([]);
    if (isMobileNav) setSidebarOpen(false);
  };

  const roleBadgeColor = user.role === USER_ROLES.SUPER_ADMIN ? '#22a05e' : user.role === USER_ROLES.ADMIN ? '#f4a823' : user.role === USER_ROLES.MANAGER ? '#f59e0b' : '#3b82f6';
  const roleInitials   = user.role === USER_ROLES.SUPER_ADMIN ? 'SA' : user.role === USER_ROLES.ADMIN ? 'AD' : user.role === USER_ROLES.MANAGER ? 'MG' : 'CA';

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard':     return <Dashboard onNavigate={openPage} />;
      case 'pos':           return <POS />;
      case 'online-orders': return <OnlineOrders />;
      case 'delivery':      return <DeliveryDashboard />;
      case 'products':      return <Products />;
      case 'coupons':    return <Coupons />;
      case 'analytics':  return <CustomerAnalytics />;
      case 'pricing':    return <DynamicPricing />;
      case 'sms':        return <SmsMarketing />;
      case 'reports':    return <Reports />;
      case 'ai':         return <AIAssistant />;
      case 'users':      return <Users />;
      default:           return <POS />;
    }
  };

  const totalNewOrders = newOrders.filter(o => !dismissedIds.has(o.id)).length;

  return (
    <div className="app">
      {isMobileNav && sidebarOpen && <button className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />}

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-brand">
          <span className="brand-icon">BK</span>
          <div>
            <div className="brand-name">BizKart</div>
            <div className="brand-sub">{user?.shop?.businessType || user?.shop?.name || DEFAULT_PLATFORM_SUBTITLE}</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {nav.map(item => (
            <button key={item.id} className={`nav-item ${activePage === item.id ? 'active' : ''}`}
              onClick={() => openPage(item.id)} style={{ position: 'relative' }}>
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{t(item.labelKey) || item.labelKey}</span>
              {item.id === 'online-orders' && totalNewOrders > 0 && (
                <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: '#ef4444', color: '#fff', borderRadius: '50%', width: 18, height: 18, fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {totalNewOrders}
                </span>
              )}
            </button>
          ))}

          {/* WhatsApp setup button */}
          {!isSuperAdmin() && (
            <button className="nav-item" onClick={() => setShowWhatsApp(true)} style={{ marginTop: 8 }}>
              <span className="nav-icon">📱</span>
              <span className="nav-label">WhatsApp {whatsappPhone ? '✓' : 'Setup'}</span>
            </button>
          )}

          {/* Shop link */}
          <button className="nav-item" onClick={onGoToShop} style={{ marginTop: 4 }}>
            <span className="nav-icon">🛒</span>
            <span className="nav-label">Customer Portal</span>
          </button>
        </nav>

        {/* Profile */}
        <div style={{ padding: 12, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, cursor: 'pointer', background: showProfile ? 'rgba(255,255,255,0.06)' : 'transparent' }}
            onClick={() => setShowProfile(v => !v)}>
            <div style={{ width: 34, height: 34, borderRadius: '50%', background: roleBadgeColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>{roleInitials}</div>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <div style={{ color: '#fff', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.fullName}</div>
              <div style={{ color: '#a8c5b5', fontSize: 11 }}>{user.role}</div>
            </div>
            <span style={{ color: '#a8c5b5', fontSize: 12 }}>{showProfile ? '^' : 'v'}</span>
          </div>
          {showProfile && (
            <div style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.04)', borderRadius: 10, marginTop: 6 }}>
              <div style={{ color: '#fff', fontSize: 12, marginBottom: 4 }}>{user?.shop?.name}</div>
              <div style={{ color: '#a8c5b5', fontSize: 12, marginBottom: 8 }}>@{user.username}</div>
              <button onClick={() => { setShowProfile(false); setShowChangePwd(true); }}
                style={{ width: '100%', padding: 8, borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', marginBottom: 8 }}>
                Change Password
              </button>
              <button onClick={logout}
                style={{ width: '100%', padding: 8, borderRadius: 8, background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>
                {t('signOut')}
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main */}
      <main className="main-content">
        {/* Topbar */}
        <div className="topbar">
          <div className="topbar-left">
            {isMobileNav && <button className="mobile-nav-toggle" onClick={() => setSidebarOpen(c => !c)}>Menu</button>}
            <div>
              <div style={{ fontWeight: 700 }}>{user?.shop?.name || 'BizKart'}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{user?.shop?.code} {user?.shop?.businessType ? `• ${user.shop.businessType}` : ''}</div>
            </div>
          </div>
          <div className="topbar-actions">
            {/* WhatsApp quick button */}
            {!isSuperAdmin() && (
              <button onClick={() => setShowWhatsApp(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: whatsappPhone ? '#dcfce7' : '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700, color: whatsappPhone ? '#15803d' : '#374151' }}>
                📱 {whatsappPhone ? `WA: ${whatsappPhone.slice(-4)}` : 'Setup WhatsApp'}
              </button>
            )}
            {/* Shop portal button */}
            <button onClick={onGoToShop}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: '#16a34a', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#fff' }}>
              🛒 Shop Portal
            </button>
            <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('language')}</label>
            <select className="form-select" style={{ width: 130 }} value={language} onChange={e => setLanguage(e.target.value)}>
              {languages.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
            </select>
            <span style={{ background: user.role === USER_ROLES.SUPER_ADMIN ? '#dcfce7' : user.role === USER_ROLES.ADMIN ? '#fef3c7' : '#dbeafe', color: user.role === USER_ROLES.SUPER_ADMIN ? '#166534' : user.role === USER_ROLES.ADMIN ? '#92400e' : '#1e40af', borderRadius: 4, padding: '2px 10px', fontSize: 12, fontWeight: 600 }}>
              {user.role}
            </span>
          </div>
        </div>

        {/* New order notification banner */}
        {totalNewOrders > 0 && (
          <OrderNotificationBanner
            orders={newOrders.filter(o => !dismissedIds.has(o.id))}
            shopPhone={whatsappPhone}
            onDismiss={dismissNotifications}
          />
        )}

        {renderPage()}
      </main>

      {showChangePwd && <ChangePasswordModal onClose={() => setShowChangePwd(false)} />}
      {showWhatsApp && <WhatsAppModal currentPhone={whatsappPhone} onSave={saveWhatsappPhone} onClose={() => setShowWhatsApp(false)} />}
    </div>
  );
}
