import React, { useState, useReducer, useCallback, useEffect, useRef } from 'react';
import axios from 'axios';

/* ── API helpers ──────────────────────────────────────────────────────── */
const TOKEN_KEY = 'bk_customer_token';

// A native app shell (Capacitor) loads the bundle from a local scheme
// (https://localhost / capacitor://localhost), not from the deployed domain,
// so relative '/api/...' calls have nowhere to resolve to. REACT_APP_API_URL
// (set to the production origin, e.g. https://mybizkart.in, for native builds)
// makes every call absolute. In a normal web build it's left blank and these
// calls stay relative/same-origin as before.
const API_BASE_URL = process.env.REACT_APP_API_URL || '';

function customerHeaders() {
  const t = localStorage.getItem(TOKEN_KEY);
  return t ? { Authorization: `Bearer ${t}` } : {};
}

const portalAPI = {
  listShops:        ()         => axios.get(`${API_BASE_URL}/api/portal/shops`),
  listProducts:     (shopId)   => axios.get(`${API_BASE_URL}/api/portal/products?shopId=${shopId}`),
  search:           (q)        => axios.get(`${API_BASE_URL}/api/portal/search?q=${encodeURIComponent(q)}`),
  placeOrder:       (data)     => axios.post(`${API_BASE_URL}/api/portal/orders`, data, { headers: customerHeaders() }),
  getMyOrders:      ()         => axios.get(`${API_BASE_URL}/api/portal/orders`,         { headers: customerHeaders() }),
  getOrder:         (id)       => axios.get(`${API_BASE_URL}/api/portal/orders/${id}`,   { headers: customerHeaders() }),
  reorder:          (id)       => axios.get(`${API_BASE_URL}/api/portal/orders/${id}/reorder`, { headers: customerHeaders() }),
  listCoupons:      (shopId)   => axios.get(`${API_BASE_URL}/api/portal/coupons?shopId=${shopId}`),
  applyCoupon:      (data)     => axios.post(`${API_BASE_URL}/api/portal/coupons/apply`, data, { headers: customerHeaders() }),
  getLoyalty:       ()         => axios.get(`${API_BASE_URL}/api/portal/loyalty`,         { headers: customerHeaders() }),
  submitReview:     (data)     => axios.post(`${API_BASE_URL}/api/portal/reviews`, data,  { headers: customerHeaders() }),
  subscribePush:    (data)     => axios.post(`${API_BASE_URL}/api/portal/push/subscribe`, data, { headers: customerHeaders() }),
  getMessages:      (orderId)  => axios.get(`${API_BASE_URL}/api/portal/orders/${orderId}/messages`, { headers: customerHeaders() }),
  sendMessage:      (orderId, msg) => axios.post(`${API_BASE_URL}/api/portal/orders/${orderId}/messages`, { message: msg }, { headers: customerHeaders() }),
  getInvoiceUrl: (orderId) => {
    const token = localStorage.getItem('bk_customer_token');
    return `${API_BASE_URL}/api/portal/orders/${orderId}/invoice${token ? '?token=' + encodeURIComponent(token) : ''}`;
  },
  getReferral:      ()         => axios.get(`${API_BASE_URL}/api/portal/referral`,        { headers: customerHeaders() }),
  getScheduledOrders: ()       => axios.get(`${API_BASE_URL}/api/portal/scheduled-orders`,{ headers: customerHeaders() }),
  createScheduledOrder: (data) => axios.post(`${API_BASE_URL}/api/portal/scheduled-orders`, data, { headers: customerHeaders() }),
  cancelScheduledOrder: (id)   => axios.delete(`${API_BASE_URL}/api/portal/scheduled-orders/${id}`, { headers: customerHeaders() }),
  getRecommendations: (shopId) => axios.get(`${API_BASE_URL}/api/portal/recommendations?shopId=${shopId}`, { headers: customerHeaders() }),
};

const customerAuthAPI = {
  register:      (data) => axios.post(`${API_BASE_URL}/api/customer-auth/register`, data),
  login:         (data) => axios.post(`${API_BASE_URL}/api/customer-auth/login`, data),
  resetPassword: (data) => axios.post(`${API_BASE_URL}/api/customer-auth/reset-password`, data),
};

/* ── Helpers ──────────────────────────────────────────────────────────── */
const fmt = v => '₹' + Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });

const EMOJI = {
  Essentials: '🧂', Dairy: '🧈', Oils: '🫙', Grains: '🌾', Vegetables: '🥦',
  Health: '🧴', Snacks: '🍫', Medicine: '💊', Pastries: '🥐', Breads: '🍞',
  Grocery: '🛒', Medicines: '💊', Bakery: '🥐', Default: '📦'
};
function getEmoji(cat) { return EMOJI[cat] || '📦'; }
function getShopEmoji(type) {
  if (!type) return '🏪';
  const t = type.toLowerCase();
  if (t.includes('kirana') || t.includes('grocery')) return '🛒';
  if (t.includes('pharma') || t.includes('medical') || t.includes('med')) return '💊';
  if (t.includes('bak')) return '🥐';
  if (t.includes('cloth')) return '👕';
  if (t.includes('elect')) return '📱';
  return '🏪';
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const STATUS_COLOR = {
  PLACED: '#3b82f6', CONFIRMED: '#10b981', PREPARING: '#f59e0b',
  OUT_FOR_DELIVERY: '#f97316', DELIVERED: '#10b981', PICKED_UP: '#10b981', CANCELLED: '#ef4444'
};
const STATUS_LABEL = {
  PLACED: 'Order Placed', CONFIRMED: 'Confirmed', PREPARING: 'Being Prepared',
  OUT_FOR_DELIVERY: 'Out for Delivery', DELIVERED: 'Delivered',
  PICKED_UP: 'Picked Up', CANCELLED: 'Cancelled'
};
const STATUS_ICON = {
  PLACED: '📋', CONFIRMED: '✅', PREPARING: '👨‍🍳',
  OUT_FOR_DELIVERY: '🛵', DELIVERED: '🏠', PICKED_UP: '🤝', CANCELLED: '❌'
};
const DELIVERY_STEPS = ['PLACED', 'CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED'];
const PICKUP_STEPS   = ['PLACED', 'CONFIRMED', 'PREPARING', 'READY', 'PICKED_UP'];

/* ── CART REDUCER ─────────────────────────────────────────────────────── */
function cartReducer(state, action) {
  switch (action.type) {
    case 'ADD': {
      const ex = state.find(i => i.product.id === action.product.id);
      return ex
        ? state.map(i => i.product.id === action.product.id ? { ...i, qty: i.qty + 1 } : i)
        : [...state, { product: action.product, qty: 1 }];
    }
    case 'SET_QTY':
      return action.qty <= 0
        ? state.filter(i => i.product.id !== action.id)
        : state.map(i => i.product.id === action.id ? { ...i, qty: action.qty } : i);
    case 'CLEAR': return [];
    default: return state;
  }
}

/* ── SMALL COMPONENTS ─────────────────────────────────────────────────── */
function Inp({ label, value, onChange, placeholder, type = 'text' }) {
  return (
    <div style={{ marginBottom: 12 }}>
      {label && <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>{label}</label>}
      <input style={css.input} type={type} value={value} placeholder={placeholder}
        onChange={e => onChange(e.target.value)} />
    </div>
  );
}

function Spinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
      <div style={{ width: 32, height: 32, border: '3px solid #e5e7eb', borderTop: '3px solid #16a34a', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function ErrBox({ msg }) {
  if (!msg) return null;
  return <div style={css.err}>{msg}</div>;
}

function Sec({ label, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: .8, marginBottom: 10 }}>{label}</div>
      {children}
    </div>
  );
}

function StarRating({ value, onChange, size = 24 }) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <span key={n} onClick={() => onChange && onChange(n)}
          style={{ fontSize: size, cursor: onChange ? 'pointer' : 'default', color: n <= value ? '#f59e0b' : '#d1d5db' }}>
          ★
        </span>
      ))}
    </div>
  );
}

/* ── PUSH NOTIFICATION HELPER ─────────────────────────────────────────── */
async function requestPushPermission() {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return false;
  if (Notification.permission === 'granted') return true;
  const perm = await Notification.requestPermission();
  return perm === 'granted';
}

function showLocalNotification(title, body) {
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    try { new Notification(title, { body, icon: '/favicon.ico' }); } catch {}
  }
}

/* ── AUTH SCREEN ──────────────────────────────────────────────────────── */
function AuthScreen({ onAuth }) {
  // mode: 'login' | 'register' | 'reset'  ('reset' = forgot-password screen, reached via link)
  const [mode, setMode]           = useState('login');
  const [phone, setPhone]         = useState('');
  const [password, setPass]       = useState('');
  const [name, setName]           = useState('');
  const [email, setEmail]         = useState('');
  const [confirm, setConfirm]     = useState('');
  const [newPassword, setNewPass] = useState('');
  const [confirmNew, setConfirmNew] = useState('');
  const [err, setErr]             = useState('');
  const [info, setInfo]           = useState('');
  const [loading, setLoading]     = useState(false);

  const submit = async () => {
    setErr(''); setInfo('');
    if (mode === 'register') {
      if (!name.trim())        { setErr('Name is required'); return; }
      if (phone.length < 10)   { setErr('Enter a valid phone number'); return; }
      if (password.length < 6) { setErr('Password must be at least 6 characters'); return; }
      if (password !== confirm) { setErr('Passwords do not match'); return; }
    }
    if (mode === 'reset') {
      if (phone.length < 10)      { setErr('Enter your registered phone number'); return; }
      if (newPassword.length < 6) { setErr('New password must be at least 6 characters'); return; }
      if (newPassword !== confirmNew) { setErr('Passwords do not match'); return; }
    }
    setLoading(true);
    try {
      if (mode === 'reset') {
        const res = await customerAuthAPI.resetPassword({ phone, newPassword });
        localStorage.setItem(TOKEN_KEY, res.data.token);
        onAuth(res.data.customer || res.data);
        return;
      }
      const fn  = mode === 'login' ? customerAuthAPI.login : customerAuthAPI.register;
      const res = await fn({ name, phone, email, password });
      localStorage.setItem(TOKEN_KEY, res.data.token);
      onAuth(res.data.customer || res.data);
    } catch (e) {
      setErr(e.response?.data?.error || e.message);
    } finally { setLoading(false); }
  };

  const goToReset = () => {
    setMode('reset'); setErr(''); setInfo('');
    setNewPass(''); setConfirmNew('');
  };

  const backToLogin = () => {
    setMode('login'); setErr('');
    setInfo('Password updated — please sign in.');
    setPass('');
  };

  return (
    <div style={css.authWrap}>
      <div style={css.authCard}>
        <div style={{ fontSize: 44, textAlign: 'center' }}>🛒</div>
        <h1 style={{ textAlign: 'center', fontSize: 26, fontWeight: 800, margin: '6px 0 4px', color: '#1a1a1a' }}>BizKart</h1>
        <p style={{ textAlign: 'center', color: '#888', fontSize: 13, marginBottom: 20 }}>Order from local stores near you</p>

        {mode !== 'reset' && (
          <div style={css.tabRow}>
            {['login', 'register'].map(m => (
              <button key={m} style={{ ...css.tabBtn, ...(mode === m ? css.tabActive : {}) }}
                onClick={() => { setMode(m); setErr(''); setInfo(''); }}>
                {m === 'login' ? 'Sign In' : 'New Account'}
              </button>
            ))}
          </div>
        )}

        {mode === 'reset' && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#1a1a1a' }}>Reset your password</div>
            <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>Enter your registered phone number and choose a new password.</div>
          </div>
        )}

        {mode === 'register' && <Inp label="Full Name" value={name} onChange={setName} placeholder="Ravi Kumar" />}
        <Inp label="Phone Number" value={phone} onChange={setPhone} placeholder="9876543210" type="tel" />
        {mode === 'register' && <Inp label="Email (optional)" value={email} onChange={setEmail} placeholder="ravi@example.com" type="email" />}

        {mode !== 'reset' && (
          <Inp label="Password" value={password} onChange={setPass} type="password" placeholder="Min 6 characters" />
        )}
        {mode === 'register' && <Inp label="Confirm Password" value={confirm} onChange={setConfirm} type="password" />}

        {mode === 'reset' && <>
          <Inp label="New Password" value={newPassword} onChange={setNewPass} type="password" placeholder="Min 6 characters" />
          <Inp label="Confirm New Password" value={confirmNew} onChange={setConfirmNew} type="password" />
        </>}

        {mode === 'login' && (
          <div style={{ textAlign: 'right', marginTop: -6, marginBottom: 14 }}>
            <button type="button" onClick={goToReset}
              style={{ background: 'none', border: 'none', padding: 0, color: '#16a34a', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              Forgot password?
            </button>
          </div>
        )}

        {info && !err && (
          <div style={{ background: '#f0fdf4', color: '#15803d', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 14, border: '1px solid #bbf7d0' }}>
            {info}
          </div>
        )}
        <ErrBox msg={err} />

        <button style={{ ...css.btnPrimary, opacity: loading ? 0.7 : 1 }} onClick={submit} disabled={loading}>
          {loading
            ? 'Please wait…'
            : mode === 'login' ? 'Sign In'
            : mode === 'register' ? 'Create Account'
            : 'Reset Password & Sign In'}
        </button>

        {mode === 'reset' && (
          <button type="button" onClick={backToLogin}
            style={{ width: '100%', background: 'none', border: 'none', padding: '10px 0 0', color: '#6b7280', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            ← Back to Sign In
          </button>
        )}
      </div>
    </div>
  );
}

/* ── SMART SEARCH ─────────────────────────────────────────────────────── */
function SmartSearch({ onSelectShop, onClose }) {
  const [q, setQ]             = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const debounceRef           = useRef(null);

  useEffect(() => {
    if (!q.trim()) { setResults(null); return; }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try { const res = await portalAPI.search(q); setResults(res.data); } catch {}
      finally { setLoading(false); }
    }, 350);
    return () => clearTimeout(debounceRef.current);
  }, [q]);

  return (
    <div style={{ padding: '0 16px 10px' }}>
      <div style={{ position: 'relative' }}>
        <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 16, color: '#9ca3af' }}>🔍</span>
        <input style={{ ...css.input, paddingLeft: 38, borderRadius: 12 }}
          placeholder="Search shops, products, categories…"
          value={q} onChange={e => setQ(e.target.value)} autoFocus />
        <button onClick={onClose} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 18 }}>×</button>
      </div>
      {loading && <div style={{ padding: '8px 0', color: '#888', fontSize: 12 }}>Searching…</div>}
      {results && (
        <div style={{ marginTop: 8, background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden', maxHeight: 360, overflowY: 'auto' }}>
          {results.shops?.length === 0 && results.products?.length === 0 && (
            <div style={{ padding: 16, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>No results for "{q}"</div>
          )}
          {results.shops?.length > 0 && <>
            <div style={{ padding: '8px 14px 4px', fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>Shops</div>
            {results.shops.map(s => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: '1px solid #f3f4f6', cursor: 'pointer' }}
                onClick={() => { onSelectShop(s); onClose(); }}>
                <span style={{ fontSize: 20 }}>{getShopEmoji(s.businessType)}</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{s.name}</div>
                  <div style={{ fontSize: 11, color: '#888' }}>{s.businessType}</div>
                </div>
              </div>
            ))}
          </>}
          {results.products?.length > 0 && <>
            <div style={{ padding: '8px 14px 4px', fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>Products</div>
            {results.products.map(p => (
              <div key={p.productId} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: '1px solid #f3f4f6', cursor: 'pointer' }}
                onClick={() => { onSelectShop({ id: p.shopId, name: p.shopName }); onClose(); }}>
                <span style={{ fontSize: 20 }}>{getEmoji(p.category)}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{p.productName}</div>
                  <div style={{ fontSize: 11, color: '#888' }}>{p.shopName} · {p.category}</div>
                </div>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#16a34a' }}>{fmt(p.price)}</div>
              </div>
            ))}
          </>}
        </div>
      )}
    </div>
  );
}

/* ── SHOP LIST ────────────────────────────────────────────────────────── */
function ShopList({ onSelect }) {
  const [shops, setShops]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [err, setErr]               = useState('');
  const [q, setQ]                   = useState('');
  const [userLoc, setUserLoc]       = useState(null);
  const [locLoading, setLocLoading] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  useEffect(() => {
    portalAPI.listShops()
      .then(res => setShops(res.data))
      .catch(e => setErr(e.response?.data?.error || 'Failed to load shops. Is the backend running?'))
      .finally(() => setLoading(false));
  }, []);

  const requestLocation = () => {
    if (!navigator.geolocation) { alert('Geolocation not supported'); return; }
    setLocLoading(true);
    navigator.geolocation.getCurrentPosition(
      pos => { setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setLocLoading(false); },
      () => { setLocLoading(false); alert('Could not get your location.'); }
    );
  };

  const sortedShops = [...shops]
    .filter(s => s.name.toLowerCase().includes(q.toLowerCase()) ||
      (s.businessType || '').toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => {
      if (userLoc && a.latitude && b.latitude) {
        const da = haversineKm(userLoc.lat, userLoc.lng, a.latitude, a.longitude);
        const db = haversineKm(userLoc.lat, userLoc.lng, b.latitude, b.longitude);
        return da - db;
      }
      return 0;
    });

  return (
    <div>
      <div style={{ padding: '18px 16px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1a1a1a' }}>Choose a store</h2>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => setShowSearch(s => !s)} style={css.iconBtn} title="Smart Search">🔍</button>
          <button onClick={requestLocation} style={css.iconBtn} title="Sort by distance" disabled={locLoading}>
            {locLoading ? '⏳' : userLoc ? '📍' : '📍'}
          </button>
        </div>
      </div>

      {showSearch && <SmartSearch onSelectShop={s => onSelect(s)} onClose={() => setShowSearch(false)} />}

      {userLoc && !showSearch && (
        <div style={{ padding: '0 16px 6px' }}>
          <div style={{ fontSize: 11, color: '#16a34a', background: '#f0fdf4', borderRadius: 8, padding: '4px 10px', display: 'inline-block' }}>
            📍 Showing nearest shops first
          </div>
        </div>
      )}

      {!showSearch && <input style={css.searchBar} placeholder="Filter stores…" value={q} onChange={e => setQ(e.target.value)} />}

      {loading && <Spinner />}
      <ErrBox msg={err} />

      <div style={{ padding: '8px 16px' }}>
        {!loading && sortedShops.length === 0 && !err && !showSearch && (
          <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>🏪</div>
            <div style={{ fontWeight: 600 }}>No shops available</div>
            <div style={{ fontSize: 12, marginTop: 6 }}>Ask the admin to add and enable a shop</div>
          </div>
        )}
        {!showSearch && sortedShops.map(s => {
          const dist = userLoc && s.latitude
            ? haversineKm(userLoc.lat, userLoc.lng, s.latitude, s.longitude).toFixed(1)
            : null;
          return (
            <div key={s.id} style={css.shopCard} onClick={() => onSelect(s)}>
              <div style={css.shopIcon}>{getShopEmoji(s.businessType)}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{s.name}</div>
                <div style={{ fontSize: 12, color: '#16a34a', fontWeight: 600 }}>{s.businessType}</div>
                <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
                  📍 {s.address || s.code}
                  {dist && <span style={{ marginLeft: 6, color: '#3b82f6' }}>· {dist} km away</span>}
                </div>
              </div>
              <div style={{ fontSize: 20, color: '#d1d5db' }}>›</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── PRODUCT LIST ─────────────────────────────────────────────────────── */
function ProductList({ shop, cart, dispatch, onBack, onCheckout }) {
  const [products, setProducts]         = useState([]);
  const [loading, setLoading]           = useState(true);
  const [err, setErr]                   = useState('');
  const [cat, setCat]                   = useState('All');
  const [ratings, setRatings]           = useState({});
  const [recommendations, setRecs]      = useState([]);
  const [recsLoading, setRecsLoading]   = useState(false);

  useEffect(() => {
    portalAPI.listProducts(shop.id)
      .then(res => {
        setProducts(res.data);
        Promise.allSettled(
          res.data.map(p =>
            axios.get(`${API_BASE_URL}/api/portal/reviews/product/${p.id}/summary`)
              .then(r => ({ id: p.id, ...r.data }))
              .catch(() => ({ id: p.id, average: 0, count: 0 }))
          )
        ).then(rs => {
          const map = {};
          rs.forEach(r => { if (r.status === 'fulfilled') map[r.value.id] = r.value; });
          setRatings(map);
        });
      })
      .catch(e => setErr(e.response?.data?.error || 'Failed to load products'))
      .finally(() => setLoading(false));

    // Load AI recommendations
    setRecsLoading(true);
    portalAPI.getRecommendations(shop.id)
      .then(r => setRecs(r.data))
      .catch(() => {})
      .finally(() => setRecsLoading(false));
  }, [shop.id]);

  const cats  = ['All', ...new Set(products.map(p => p.category).filter(Boolean))];
  const shown = products.filter(p => cat === 'All' || p.category === cat);
  const total = cart.reduce((s, i) => s + Number(i.product.price) * i.qty, 0);
  const count = cart.reduce((s, i) => s + i.qty, 0);

  return (
    <div>
      <div style={css.topbar}>
        <button style={css.backBtn} onClick={onBack}>← Back</button>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{shop.name}</div>
          <div style={{ fontSize: 11, color: '#888' }}>{shop.businessType}</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '10px 14px', background: '#fff', borderBottom: '1px solid #e5e7eb' }}>
        {cats.map(c => (
          <button key={c} style={{ ...css.chip, ...(cat === c ? css.chipActive : {}) }} onClick={() => setCat(c)}>{c}</button>
        ))}
      </div>

      {/* AI Recommendations */}
      {(recsLoading || recommendations.length > 0) && (
        <div style={{ padding: '12px 14px 0' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: .6, marginBottom: 8 }}>🤖 Recommended for you</div>
          {recsLoading ? (
            <div style={{ fontSize: 12, color: '#9ca3af' }}>Finding recommendations…</div>
          ) : (
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8 }}>
              {recommendations.map(rec => {
                const inCart = cart.find(i => i.product.id === rec.productId);
                return (
                  <div key={rec.productId} style={{ flexShrink: 0, width: 130, background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ fontSize: 10, color: '#3b82f6', fontWeight: 600 }}>{rec.reason}</div>
                    <div style={{ fontWeight: 700, fontSize: 12, lineHeight: 1.3 }}>{rec.productName}</div>
                    <div style={{ fontWeight: 800, fontSize: 14, color: '#16a34a' }}>{fmt(rec.price)}</div>
                    {inCart ? (
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <button style={{ ...css.qBtn, width: 22, height: 22 }} onClick={() => dispatch({ type: 'SET_QTY', id: rec.productId, qty: inCart.qty - 1 })}>−</button>
                        <span style={{ flex: 1, textAlign: 'center', fontWeight: 700, fontSize: 12 }}>{inCart.qty}</span>
                        <button style={{ ...css.qBtn, width: 22, height: 22 }} onClick={() => dispatch({ type: 'SET_QTY', id: rec.productId, qty: inCart.qty + 1 })}>+</button>
                      </div>
                    ) : (
                      <button style={{ ...css.addBtn, fontSize: 11 }}
                        onClick={() => dispatch({ type: 'ADD', product: { id: rec.productId, name: rec.productName, price: rec.price, category: rec.category, stock: rec.stock } })}>
                        + Add
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {loading && <Spinner />}
      <ErrBox msg={err} />
      {!loading && shown.length === 0 && !err && (
        <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>📦</div>
          <div>No products in this category</div>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: 14 }}>
        {shown.map(p => {
          const inCart = cart.find(i => i.product.id === p.id);
          const rv     = ratings[p.id];
          return (
            <div key={p.id} style={css.productCard}>
              <div style={{ fontSize: 24 }}>{getEmoji(p.category)}</div>
              <div style={{ fontWeight: 700, fontSize: 13, lineHeight: 1.3 }}>{p.name}</div>
              {rv && rv.count > 0 && (
                <div style={{ fontSize: 10, color: '#f59e0b' }}>
                  {'★'.repeat(Math.round(rv.average))}{'☆'.repeat(5 - Math.round(rv.average))}
                  <span style={{ color: '#9ca3af', marginLeft: 3 }}>({rv.count})</span>
                </div>
              )}
              <div style={{ fontSize: 11, color: '#9ca3af' }}>{p.unit || ''}</div>
              <div style={{ fontWeight: 800, fontSize: 16, color: '#16a34a', margin: '4px 0' }}>{fmt(p.price)}</div>
              {p.stock === 0 ? (
                <div style={{ padding: '7px 0', background: '#f9fafb', borderRadius: 8, color: '#9ca3af', fontSize: 12, textAlign: 'center' }}>Out of stock</div>
              ) : inCart ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button style={css.qBtn} onClick={() => dispatch({ type: 'SET_QTY', id: p.id, qty: inCart.qty - 1 })}>−</button>
                  <span style={{ flex: 1, textAlign: 'center', fontWeight: 700 }}>{inCart.qty}</span>
                  <button style={css.qBtn} onClick={() => dispatch({ type: 'SET_QTY', id: p.id, qty: inCart.qty + 1 })}>+</button>
                </div>
              ) : (
                <button style={css.addBtn} onClick={() => dispatch({ type: 'ADD', product: p })}>+ Add</button>
              )}
            </div>
          );
        })}
      </div>
      {count > 0 && (
        <div style={css.cartBar} onClick={onCheckout}>
          <span style={{ background: 'rgba(255,255,255,.2)', padding: '2px 8px', borderRadius: 20, fontSize: 11 }}>
            {count} item{count > 1 ? 's' : ''}
          </span>
          <span>View Cart · {fmt(total)}</span>
          <span>›</span>
        </div>
      )}
    </div>
  );
}

/* ── CHECKOUT ─────────────────────────────────────────────────────────── */
function Checkout({ shop, cart, dispatch, customer, onBack, onPlaced }) {
  const [orderType, setOrderType]       = useState('DELIVERY');
  const [payment, setPayment]           = useState('COD');
  const [upiRef, setUpiRef]             = useState('');
  const [addr, setAddr]                 = useState({ line1: '', line2: '', city: '', pincode: '', landmark: '' });
  const [couponCode, setCouponCode]     = useState('');
  const [couponResult, setCouponResult] = useState(null);
  const [couponErr, setCouponErr]       = useState('');
  const [couponLoading, setCouponLoading] = useState(false);
  const [coupons, setCoupons]           = useState([]);
  const [loyalty, setLoyalty]           = useState(null);
  const [redeemPoints, setRedeemPoints] = useState(0);
  const [err, setErr]                   = useState('');
  const [loading, setLoading]           = useState(false);

  const subtotal       = cart.reduce((s, i) => s + Number(i.product.price) * i.qty, 0);
  const fee            = orderType === 'DELIVERY' ? 30 : 0;
  const couponDiscount = couponResult ? Number(couponResult.discount) : 0;
  const loyaltyDiscount = redeemPoints * 0.50;
  const total          = Math.max(0, subtotal + fee - couponDiscount - loyaltyDiscount);

  useEffect(() => {
    portalAPI.listCoupons(shop.id).then(r => setCoupons(r.data)).catch(() => {});
    portalAPI.getLoyalty().then(r => setLoyalty(r.data)).catch(() => {});
  }, [shop.id]);

  const applyCoupon = async () => {
    if (!couponCode.trim()) return;
    setCouponErr(''); setCouponLoading(true);
    try {
      const res = await portalAPI.applyCoupon({ code: couponCode, subtotal, shopId: shop.id });
      setCouponResult(res.data);
    } catch (e) {
      setCouponErr(e.response?.data?.error || 'Invalid coupon');
      setCouponResult(null);
    } finally { setCouponLoading(false); }
  };

  const maxRedeemPoints = loyalty
    ? Math.min(loyalty.points, Math.floor((subtotal + fee - couponDiscount) * 0.20 / 0.50))
    : 0;

  const place = async () => {
    if (orderType === 'DELIVERY' && (!addr.line1 || !addr.city || !addr.pincode)) {
      setErr('Please fill address line 1, city and pincode'); return;
    }
    setErr(''); setLoading(true);
    try {
      const addressText = orderType === 'DELIVERY'
        ? `${addr.line1}${addr.line2 ? ', ' + addr.line2 : ''}, ${addr.city} - ${addr.pincode}${addr.landmark ? ', Near ' + addr.landmark : ''}`
        : null;
      const res = await portalAPI.placeOrder({
        shopId: shop.id,
        orderType,
        deliveryAddress: addressText,
        paymentMethod: payment,
        paymentReference: payment === 'UPI' && upiRef.trim() ? upiRef.trim() : null,
        customerNotes: '',
        couponCode: couponResult ? couponResult.code : null,
        loyaltyPointsToRedeem: redeemPoints > 0 ? redeemPoints : null,
        items: cart.map(i => ({ productId: i.product.id, quantity: i.qty })),
      });
      dispatch({ type: 'CLEAR' });
      showLocalNotification('Order Placed! 🎉', `Your order ${res.data.orderNumber} has been received.`);
      onPlaced(res.data);
    } catch (e) {
      setErr(e.response?.data?.error || e.message || 'Failed to place order');
    } finally { setLoading(false); }
  };

  return (
    <div>
      <div style={css.topbar}>
        <button style={css.backBtn} onClick={onBack}>← Back</button>
        <div style={{ fontWeight: 700, fontSize: 16 }}>Checkout</div>
      </div>
      <div style={{ padding: '14px 16px 0' }}>

        {/* Cart summary */}
        <Sec label="Order summary">
          {cart.map(i => (
            <div key={i.product.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #f3f4f6', fontSize: 13 }}>
              <span style={{ flex: 1 }}>{i.product.name}</span>
              <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                <button style={css.qBtnSm} onClick={() => dispatch({ type: 'SET_QTY', id: i.product.id, qty: i.qty - 1 })}>−</button>
                <span style={{ minWidth: 20, textAlign: 'center', fontWeight: 600 }}>{i.qty}</span>
                <button style={css.qBtnSm} onClick={() => dispatch({ type: 'SET_QTY', id: i.product.id, qty: i.qty + 1 })}>+</button>
              </div>
              <span style={{ minWidth: 65, textAlign: 'right', fontWeight: 600 }}>{fmt(Number(i.product.price) * i.qty)}</span>
            </div>
          ))}
          <div style={{ borderTop: '1px dashed #e5e7eb', marginTop: 8, paddingTop: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '3px 0' }}><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
            {fee > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '3px 0' }}><span>Delivery fee</span><span>{fmt(fee)}</span></div>}
            {couponDiscount > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '3px 0', color: '#16a34a' }}><span>🎁 Coupon ({couponResult?.code})</span><span>−{fmt(couponDiscount)}</span></div>}
            {loyaltyDiscount > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '3px 0', color: '#7c3aed' }}><span>⭐ Loyalty ({redeemPoints} pts)</span><span>−{fmt(loyaltyDiscount)}</span></div>}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 16, marginTop: 4 }}><span>Total</span><span>{fmt(total)}</span></div>
          </div>
        </Sec>

        {/* Order type */}
        <Sec label="How do you want it?">
          <div style={{ display: 'flex', gap: 10 }}>
            {[['DELIVERY', '🛵', 'Home Delivery', 'Delivered to door'], ['PICKUP', '🏪', 'Pickup', 'Collect from store']].map(([t, e, l, s]) => (
              <div key={t} style={{ ...css.optCard, ...(orderType === t ? css.optSel : {}) }} onClick={() => setOrderType(t)}>
                <span style={{ fontSize: 24 }}>{e}</span>
                <span style={{ fontWeight: 700, fontSize: 13 }}>{l}</span>
                <span style={{ fontSize: 11, color: '#888' }}>{s}</span>
              </div>
            ))}
          </div>
        </Sec>

        {/* Address */}
        {orderType === 'DELIVERY' ? (
          <Sec label="Delivery address">
            <Inp label="Address Line 1 *" value={addr.line1} onChange={v => setAddr(a => ({ ...a, line1: v }))} placeholder="House/Flat No, Street" />
            <Inp label="Address Line 2"   value={addr.line2} onChange={v => setAddr(a => ({ ...a, line2: v }))} placeholder="Area, Colony" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Inp label="City *"    value={addr.city}    onChange={v => setAddr(a => ({ ...a, city: v }))}    placeholder="Hyderabad" />
              <Inp label="Pincode *" value={addr.pincode} onChange={v => setAddr(a => ({ ...a, pincode: v.replace(/\D/g, '') }))} placeholder="500001" type="tel" />
            </div>
            <Inp label="Landmark" value={addr.landmark} onChange={v => setAddr(a => ({ ...a, landmark: v }))} placeholder="Near Metro Station" />
          </Sec>
        ) : (
          <div style={{ background: '#f0fdf4', borderRadius: 12, padding: 14, marginBottom: 16, border: '1px solid #bbf7d0' }}>
            <div style={{ fontWeight: 700, fontSize: 13 }}>📍 Pickup from Store</div>
            <div style={{ fontSize: 13, color: '#555', marginTop: 4 }}>{shop.address || shop.name}</div>
          </div>
        )}

        {/* Coupons */}
        <Sec label="🎁 Coupons & Offers">
          {coupons.length > 0 && (
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 10, paddingBottom: 4 }}>
              {coupons.map(c => (
                <div key={c.id} onClick={() => setCouponCode(c.code)}
                  style={{ flexShrink: 0, border: '1.5px dashed #16a34a', borderRadius: 10, padding: '6px 12px', cursor: 'pointer', background: couponCode === c.code ? '#f0fdf4' : '#fff' }}>
                  <div style={{ fontWeight: 700, fontSize: 12, color: '#16a34a' }}>{c.code}</div>
                  <div style={{ fontSize: 10, color: '#555' }}>
                    {c.discountType === 'PERCENT' ? `${c.discountValue}% off` : `₹${c.discountValue} off`}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <input style={{ ...css.input, flex: 1 }} placeholder="Enter coupon code"
              value={couponCode}
              onChange={e => { setCouponCode(e.target.value.toUpperCase()); setCouponResult(null); setCouponErr(''); }} />
            <button style={{ ...css.btnPrimary, width: 'auto', padding: '0 16px', marginTop: 0, fontSize: 13 }}
              onClick={applyCoupon} disabled={couponLoading || !couponCode.trim()}>
              {couponLoading ? '…' : 'Apply'}
            </button>
          </div>
          {couponResult && (
            <div style={{ marginTop: 6, background: '#f0fdf4', borderRadius: 8, padding: '7px 11px', fontSize: 12, color: '#15803d' }}>
              ✅ {couponResult.description || couponResult.code} — saving {fmt(couponResult.discount)}
            </div>
          )}
          {couponErr && <div style={{ ...css.err, marginTop: 6 }}>{couponErr}</div>}
        </Sec>

        {/* Loyalty Points */}
        {loyalty && loyalty.points > 0 && maxRedeemPoints > 0 && (
          <Sec label="⭐ Loyalty Points">
            <div style={{ background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#7c3aed' }}>
                You have {loyalty.points} pts ≈ {fmt(loyalty.rupeeValue)}
              </div>
              <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
                Max redeemable: {maxRedeemPoints} pts = {fmt(maxRedeemPoints * 0.50)}
              </div>
              <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="range" min="0" max={maxRedeemPoints} value={redeemPoints}
                  onChange={e => setRedeemPoints(Number(e.target.value))}
                  style={{ flex: 1, accentColor: '#7c3aed' }} />
                <span style={{ fontWeight: 700, color: '#7c3aed', fontSize: 13, minWidth: 60, textAlign: 'right' }}>
                  {redeemPoints} pts
                </span>
              </div>
            </div>
          </Sec>
        )}

        {/* Payment */}
        <Sec label="Payment method">
          <div style={{ display: 'flex', gap: 8 }}>
            {[['COD', '💵', 'Cash on Delivery'], ['UPI', '📱', 'UPI / GPay'], ['CARD', '💳', 'Card']].map(([m, e, l]) => (
              <div key={m} style={{ ...css.optCard, ...(payment === m ? css.optSel : {}) }} onClick={() => setPayment(m)}>
                <span style={{ fontSize: 22 }}>{e}</span>
                <span style={{ fontWeight: 700, fontSize: 12 }}>{l}</span>
              </div>
            ))}
          </div>

          {payment === 'UPI' && (
            <div style={{ marginTop: 12, padding: 14, background: '#fafafa', borderRadius: 12, border: '1px solid #eee' }}>
              {shop.upiQrImage ? (
                <div style={{ textAlign: 'center', marginBottom: 12 }}>
                  <img src={shop.upiQrImage} alt={`${shop.name} UPI QR`}
                    style={{ width: 200, maxWidth: '100%', borderRadius: 12, border: '1px solid #e5e7eb' }} />
                  <div style={{ marginTop: 8, fontSize: 12, color: '#6b7280' }}>
                    Scan with any UPI app and pay {fmt(total)} to {shop.name}
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 12, textAlign: 'center' }}>
                  This store hasn't set up a UPI QR code yet — pay via your UPI app using their number and enter the reference below.
                </div>
              )}
              <input
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }}
                placeholder="UPI transaction reference (optional)"
                value={upiRef}
                onChange={e => setUpiRef(e.target.value)}
              />
            </div>
          )}
        </Sec>

        <ErrBox msg={err} />
        <button style={{ ...css.btnPrimary, opacity: loading ? 0.7 : 1 }} onClick={place} disabled={loading || cart.length === 0}>
          {loading ? 'Placing order…' : `Place Order · ${fmt(total)}`}
        </button>
        <div style={{ height: 24 }} />
      </div>
    </div>
  );
}

/* ── REVIEW FORM ──────────────────────────────────────────────────────── */
function ReviewForm({ order, onDone }) {
  const [shopRating, setShopRating]         = useState(0);
  const [shopComment, setShopComment]       = useState('');
  const [productRatings, setProductRatings] = useState({});
  const [loading, setLoading]               = useState(false);
  const [submitted, setSubmitted]           = useState(false);

  const setPR = (id, field, val) =>
    setProductRatings(prev => ({ ...prev, [id]: { ...prev[id], [field]: val } }));

  const submit = async () => {
    setLoading(true);
    try {
      if (shopRating > 0)
        await portalAPI.submitReview({ orderId: order.id, productId: null, rating: shopRating, comment: shopComment });
      for (const item of (order.items || [])) {
        const pid = item.product?.id || item.productId;
        const pr  = productRatings[pid];
        if (pr?.rating > 0)
          await portalAPI.submitReview({ orderId: order.id, productId: pid, rating: pr.rating, comment: pr.comment || '' });
      }
      setSubmitted(true);
    } catch (e) { alert(e.response?.data?.error || 'Failed to submit'); }
    finally { setLoading(false); }
  };

  if (submitted) return (
    <div style={{ textAlign: 'center', padding: '40px 20px' }}>
      <div style={{ fontSize: 48, marginBottom: 10 }}>⭐</div>
      <div style={{ fontWeight: 700, fontSize: 18 }}>Thanks for your review!</div>
      <button style={{ ...css.btnPrimary, marginTop: 20 }} onClick={onDone}>Done</button>
    </div>
  );

  return (
    <div style={{ padding: '14px 16px' }}>
      <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 16 }}>Rate your order</h2>
      <Sec label={`How was ${order.shop?.name}?`}>
        <StarRating value={shopRating} onChange={setShopRating} size={32} />
        {shopRating > 0 && (
          <textarea style={{ ...css.input, marginTop: 8, minHeight: 70, resize: 'vertical' }}
            placeholder="Leave a comment (optional)" value={shopComment}
            onChange={e => setShopComment(e.target.value)} />
        )}
      </Sec>
      {(order.items || []).map(item => {
        const pid  = item.product?.id || item.productId;
        const name = item.productName || item.product?.name;
        const pr   = productRatings[pid] || {};
        return (
          <Sec key={pid} label={name}>
            <StarRating value={pr.rating || 0} onChange={v => setPR(pid, 'rating', v)} size={24} />
            {pr.rating > 0 && (
              <textarea style={{ ...css.input, marginTop: 6, minHeight: 55, resize: 'vertical' }}
                placeholder="Comment (optional)" value={pr.comment || ''}
                onChange={e => setPR(pid, 'comment', e.target.value)} />
            )}
          </Sec>
        );
      })}
      <button style={{ ...css.btnPrimary, opacity: loading ? 0.7 : 1 }} onClick={submit} disabled={loading}>
        {loading ? 'Submitting…' : 'Submit Review'}
      </button>
      <button style={{ ...css.btnPrimary, background: '#f3f4f6', color: '#111', marginTop: 8 }} onClick={onDone}>Skip</button>
    </div>
  );
}

/* ── ORDER CHAT ───────────────────────────────────────────────────────── */
function OrderChat({ orderId, customerId }) {
  const [messages, setMessages] = useState([]);
  const [newMsg, setNewMsg]     = useState('');
  const [sending, setSending]   = useState(false);
  const bottomRef               = useRef(null);

  const load = useCallback(async () => {
    try { const r = await portalAPI.getMessages(orderId); setMessages(r.data); } catch {}
  }, [orderId]);

  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, [load]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const send = async () => {
    if (!newMsg.trim()) return;
    setSending(true);
    try {
      await portalAPI.sendMessage(orderId, newMsg.trim());
      setNewMsg('');
      load();
    } catch {} finally { setSending(false); }
  };

  return (
    <div style={{ margin: '0 14px 14px', background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
      <div style={{ padding: '11px 14px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb', fontWeight: 700, fontSize: 13 }}>
        💬 Chat with Shop
      </div>
      <div style={{ maxHeight: 200, overflowY: 'auto', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: 12, padding: 12 }}>No messages yet</div>
        )}
        {messages.map(m => {
          const isMe = m.senderType === 'CUSTOMER';
          return (
            <div key={m.id} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
              <div style={{ maxWidth: '75%', background: isMe ? '#16a34a' : '#f3f4f6', color: isMe ? '#fff' : '#111', borderRadius: isMe ? '14px 14px 2px 14px' : '14px 14px 14px 2px', padding: '8px 12px', fontSize: 13 }}>
                {m.message}
                <div style={{ fontSize: 10, opacity: 0.7, marginTop: 3 }}>
                  {m.createdAt ? new Date(m.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : ''}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      <div style={{ display: 'flex', gap: 8, padding: '8px 12px', borderTop: '1px solid #f3f4f6' }}>
        <input style={{ ...css.input, flex: 1, borderRadius: 10, padding: '8px 12px' }}
          placeholder="Type a message…" value={newMsg}
          onChange={e => setNewMsg(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()} />
        <button onClick={send} disabled={sending || !newMsg.trim()}
          style={{ padding: '8px 14px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
          {sending ? '…' : '↑'}
        </button>
      </div>
    </div>
  );
}

/* ── SCHEDULED ORDERS PANEL ───────────────────────────────────────────── */
function ScheduledOrdersPanel({ shops }) {
  const [orders, setOrders]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [shopId, setShopId]       = useState('');
  const [frequency, setFrequency] = useState('DAILY');
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [delivTime, setDelivTime] = useState('10:00');
  const [orderType, setOrderType] = useState('DELIVERY');
  const [itemsJson, setItemsJson] = useState('[]');
  const [saving, setSaving]       = useState(false);
  const [err, setErr]             = useState('');

  const load = async () => {
    setLoading(true);
    try { const r = await portalAPI.getScheduledOrders(); setOrders(r.data); } catch {}
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const cancel = async (id) => {
    if (!window.confirm('Cancel this scheduled order?')) return;
    try { await portalAPI.cancelScheduledOrder(id); load(); } catch {}
  };

  const save = async () => {
    if (!shopId) { setErr('Select a shop'); return; }
    setSaving(true); setErr('');
    try {
      await portalAPI.createScheduledOrder({
        shopId: Number(shopId),
        frequency,
        dayOfWeek: frequency === 'WEEKLY' ? dayOfWeek : null,
        deliveryTime: delivTime,
        orderType,
        itemsJson: itemsJson || '[]',
      });
      setShowForm(false);
      load();
    } catch (e) { setErr(e.response?.data?.error || 'Failed to create'); }
    finally { setSaving(false); }
  };

  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, marginBottom: 12 }}>
      <div style={{ padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f3f4f6' }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>🗓️ Scheduled Orders</div>
        <button style={{ padding: '5px 12px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
          onClick={() => setShowForm(s => !s)}>
          {showForm ? 'Cancel' : '+ New'}
        </button>
      </div>

      {showForm && (
        <div style={{ padding: '12px 16px', background: '#f9fafb', borderBottom: '1px solid #f3f4f6' }}>
          <div style={{ marginBottom: 8 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 3 }}>Shop</label>
            <select style={{ ...css.input }} value={shopId} onChange={e => setShopId(e.target.value)}>
              <option value="">Select shop…</option>
              {shops.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 3 }}>Frequency</label>
              <select style={css.input} value={frequency} onChange={e => setFrequency(e.target.value)}>
                <option value="DAILY">Daily</option>
                <option value="WEEKLY">Weekly</option>
              </select>
            </div>
            {frequency === 'WEEKLY' && (
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 3 }}>Day</label>
                <select style={css.input} value={dayOfWeek} onChange={e => setDayOfWeek(Number(e.target.value))}>
                  {DAYS.map((d, i) => <option key={i+1} value={i+1}>{d}</option>)}
                </select>
              </div>
            )}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 3 }}>Delivery Time</label>
              <input type="time" style={css.input} value={delivTime} onChange={e => setDelivTime(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 3 }}>Type</label>
              <select style={css.input} value={orderType} onChange={e => setOrderType(e.target.value)}>
                <option value="DELIVERY">Delivery</option>
                <option value="PICKUP">Pickup</option>
              </select>
            </div>
          </div>
          {err && <div style={{ fontSize: 12, color: '#b91c1c', marginBottom: 6 }}>{err}</div>}
          <button style={{ ...css.btnPrimary, marginTop: 0, opacity: saving ? 0.7 : 1 }} onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Create Scheduled Order'}
          </button>
        </div>
      )}

      {loading ? (
        <div style={{ padding: 16, textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>Loading…</div>
      ) : orders.length === 0 ? (
        <div style={{ padding: '16px', color: '#9ca3af', fontSize: 12, textAlign: 'center' }}>No scheduled orders</div>
      ) : orders.map(so => (
        <div key={so.id} style={{ padding: '12px 16px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{so.shop?.name}</div>
            <div style={{ fontSize: 11, color: '#888' }}>
              {so.frequency === 'DAILY' ? 'Daily' : `Every ${DAYS[(so.dayOfWeek || 1) - 1]}`} at {so.deliveryTime}
            </div>
            {so.nextRunAt && (
              <div style={{ fontSize: 10, color: '#3b82f6' }}>
                Next: {new Date(so.nextRunAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: so.active ? '#dcfce7' : '#f3f4f6', color: so.active ? '#15803d' : '#9ca3af', fontWeight: 700 }}>
              {so.active ? 'Active' : 'Paused'}
            </span>
            {so.active && (
              <button onClick={() => cancel(so.id)}
                style={{ padding: '4px 10px', background: '#fef2f2', color: '#b91c1c', border: 'none', borderRadius: 7, fontSize: 11, cursor: 'pointer' }}>
                Cancel
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── CONFIRM ──────────────────────────────────────────────────────────── */
function Confirm({ order, onTrack, onHome }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '44px 22px', textAlign: 'center' }}>
      <div style={{ fontSize: 60, marginBottom: 10 }}>✅</div>
      <h2 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 6px', color: '#1a1a1a' }}>Order Placed!</h2>
      <div style={{ fontSize: 12, color: '#16a34a', fontWeight: 700, marginBottom: 6 }}>{order.orderNumber}</div>
      <div style={{ fontSize: 13, color: '#888', marginBottom: 22 }}>
        {order.orderType === 'DELIVERY' ? 'Estimated delivery: 30–45 min' : 'Ready for pickup in: 15–20 min'}
      </div>
      {order.loyaltyPointsEarned > 0 && (
        <div style={{ background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: 12, padding: '10px 18px', marginBottom: 14, width: '100%' }}>
          <span style={{ fontSize: 18 }}>⭐</span>
          <span style={{ fontWeight: 700, color: '#7c3aed', marginLeft: 6 }}>+{order.loyaltyPointsEarned} points earned!</span>
        </div>
      )}
      <div style={{ width: '100%', background: '#f9fafb', borderRadius: 13, padding: '14px 18px', marginBottom: 22, textAlign: 'left' }}>
        {[
          ['Shop', order.shop?.name || ''],
          ['Total', fmt(order.totalAmount)],
          order.couponCode ? ['Coupon', `${order.couponCode} (−${fmt(order.couponDiscount)})`] : null,
          order.loyaltyPointsUsed > 0 ? ['Points Used', `${order.loyaltyPointsUsed} pts`] : null,
          ['Payment', order.paymentMethod === 'COD' ? 'Cash on Delivery' : order.paymentMethod],
          ['Type', order.orderType],
          order.deliveryAddressText ? ['Address', order.deliveryAddressText] : null,
        ].filter(Boolean).map(([k, v]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '5px 0', borderBottom: '1px solid #f3f4f6' }}>
            <span style={{ color: '#6b7280' }}>{k}</span>
            <span style={{ fontWeight: 600, maxWidth: 220, textAlign: 'right' }}>{v}</span>
          </div>
        ))}
      </div>
      <button style={css.btnPrimary} onClick={onTrack}>Track Order</button>
      <button style={{ ...css.btnPrimary, background: '#f3f4f6', color: '#111', marginTop: 10 }} onClick={onHome}>Order Again</button>
    </div>
  );
}

/* ── TRACK ────────────────────────────────────────────────────────────── */
function Track({ order: initOrder, onBack, onReview }) {
  const [order, setOrder]       = useState(initOrder);
  const [loading, setLoading]   = useState(false);
  const [showChat, setShowChat] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try { const res = await portalAPI.getOrder(order.id); setOrder(res.data); } catch {}
    finally { setLoading(false); }
  }, [order.id]);

  useEffect(() => {
    const id = setInterval(refresh, 30000);
    return () => clearInterval(id);
  }, [refresh]);

  const steps  = order.orderType === 'DELIVERY' ? DELIVERY_STEPS : PICKUP_STEPS;
  const curIdx = steps.indexOf(order.status);
  const done   = ['DELIVERED', 'PICKED_UP'].includes(order.status);

  return (
    <div>
      <div style={css.topbar}>
        <button style={css.backBtn} onClick={onBack}>← Orders</button>
        <div>
          <div style={{ fontWeight: 700 }}>Track Order</div>
          <div style={{ fontSize: 11, color: '#888' }}>{order.orderNumber}</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button style={css.backBtn} onClick={() => setShowChat(s => !s)} title="Chat with shop">💬</button>
          <button style={css.backBtn} onClick={refresh} disabled={loading}>{loading ? '…' : '↺'}</button>
        </div>
      </div>
      <div style={{ margin: 14, background: '#fff', borderRadius: 14, padding: 18, border: '1px solid #e5e7eb' }}>
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 44 }}>{STATUS_ICON[order.status] || '📦'}</div>
          <div style={{ fontWeight: 700, fontSize: 18, marginTop: 6 }}>{STATUS_LABEL[order.status] || order.status}</div>
          {!done && <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
            {order.orderType === 'DELIVERY' ? 'Est. 30–45 min' : 'Est. 15–20 min'}
          </div>}
        </div>
        {steps.map((step, idx) => {
          const isDone   = idx <= curIdx;
          const isActive = idx === curIdx;
          const col      = STATUS_COLOR[step] || '#9ca3af';
          const hist     = (order.statusHistory || []).find(h => h.status === step);
          return (
            <div key={step} style={{ display: 'flex', gap: 12, paddingBottom: 4 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ width: 22, height: 22, borderRadius: '50%', background: isDone ? col : '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#fff', fontWeight: 700, flexShrink: 0, boxShadow: isActive ? `0 0 0 4px ${col}33` : 'none' }}>
                  {isDone ? '✓' : ''}
                </div>
                {idx < steps.length - 1 && (
                  <div style={{ width: 2, flex: 1, minHeight: 22, background: isDone && idx < curIdx ? '#10b981' : '#e5e7eb', margin: '2px auto' }} />
                )}
              </div>
              <div style={{ paddingTop: 2, paddingBottom: 14 }}>
                <div style={{ fontWeight: isActive ? 700 : 500, color: isDone ? '#111' : '#aaa', fontSize: 13 }}>
                  {STATUS_LABEL[step] || step}
                </div>
                {hist && (
                  <div style={{ fontSize: 10, color: '#9ca3af' }}>
                    {new Date(hist.createdAt || hist.timestamp || Date.now()).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {/* Live map link when out for delivery and agent location known */}
      {order.status === 'OUT_FOR_DELIVERY' && order.agentLatitude && (
        <div style={{ margin: '0 14px 10px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12, padding: '12px 14px' }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#1d4ed8' }}>🗺️ Live Delivery Tracking</div>
          <a href={`https://www.google.com/maps?q=${order.agentLatitude},${order.agentLongitude}`}
            target="_blank" rel="noreferrer"
            style={{ fontSize: 12, color: '#2563eb', marginTop: 4, display: 'block', textDecoration: 'underline' }}>
            View delivery agent on map ↗
          </a>
        </div>
      )}

      {showChat && <OrderChat orderId={order.id} />}

      {done && (
        <div style={{ margin: '0 14px 10px', display: 'flex', gap: 8 }}>
          <button style={{ ...css.btnPrimary, background: '#f59e0b', flex: 1 }} onClick={() => onReview(order)}>
            ⭐ Rate this order
          </button>
          <a href={portalAPI.getInvoiceUrl(order.id)}
            target="_blank" rel="noreferrer"
            style={{ ...css.btnPrimary, flex: 1, background: '#f3f4f6', color: '#374151', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            🧾 Invoice
          </a>
        </div>
      )}
      <div style={{ padding: '0 14px' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', marginBottom: 8 }}>Items</div>
        {(order.items || []).map((it, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
            <span>{it.productName || it.product?.name} ×{it.quantity}</span>
            <span style={{ fontWeight: 600 }}>{fmt(it.subtotal)}</span>
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 15, padding: '10px 0' }}>
          <span>Total</span><span>{fmt(order.totalAmount)}</span>
        </div>
      </div>
    </div>
  );
}

/* ── ORDER HISTORY ────────────────────────────────────────────────────── */
function OrderHistory({ onTrack, onReorder }) {
  const [orders, setOrders]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [err, setErr]             = useState('');
  const [reordering, setReordering] = useState(null);

  useEffect(() => {
    portalAPI.getMyOrders()
      .then(res => setOrders(res.data))
      .catch(e => setErr(e.response?.data?.error || 'Failed to load orders'))
      .finally(() => setLoading(false));
  }, []);

  const handleReorder = async (e, orderId) => {
    e.stopPropagation();
    setReordering(orderId);
    try {
      const res = await portalAPI.reorder(orderId);
      onReorder(res.data); // passes { shopId, shopName, items }
    } catch (ex) { alert(ex.response?.data?.error || 'Could not reorder'); }
    finally { setReordering(null); }
  };

  return (
    <div>
      <div style={{ padding: '18px 16px 8px' }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1a1a1a' }}>My Orders</h2>
      </div>
      {loading && <Spinner />}
      <ErrBox msg={err} />
      {!loading && orders.length === 0 && !err && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 60, gap: 10, color: '#9ca3af' }}>
          <div style={{ fontSize: 44 }}>📦</div>
          <div style={{ fontWeight: 600 }}>No orders yet</div>
          <div style={{ fontSize: 12 }}>Start shopping to see your orders here</div>
        </div>
      )}
      {orders.map(o => (
        <div key={o.id} style={{ margin: '6px 14px', padding: '13px 15px', background: '#fff', borderRadius: 13, border: '1px solid #e5e7eb', cursor: 'pointer', borderLeft: `4px solid ${STATUS_COLOR[o.status] || '#9ca3af'}` }}
          onClick={() => onTrack(o)}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{o.shop?.name}</div>
              <div style={{ fontSize: 11, color: '#888' }}>{o.orderNumber}</div>
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: '#f3f4f6', color: STATUS_COLOR[o.status] || '#374151' }}>
              {STATUS_LABEL[o.status] || o.status}
            </span>
          </div>
          <div style={{ fontSize: 12, color: '#555' }}>
            {(o.items || []).length} item{(o.items || []).length !== 1 ? 's' : ''} · {fmt(o.totalAmount)} · {o.orderType} · {o.paymentMethod}
          </div>
          {o.loyaltyPointsEarned > 0 && (
            <div style={{ fontSize: 11, color: '#7c3aed', marginTop: 3 }}>⭐ +{o.loyaltyPointsEarned} pts earned</div>
          )}
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            {['DELIVERED', 'PICKED_UP', 'CANCELLED'].includes(o.status) && (
              <button onClick={e => handleReorder(e, o.id)}
                disabled={reordering === o.id}
                style={{ padding: '5px 12px', background: '#f0fdf4', border: '1px solid #86efac', color: '#15803d', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                {reordering === o.id ? '…' : '🔁 Reorder'}
              </button>
            )}
            {['DELIVERED', 'PICKED_UP'].includes(o.status) && (
              <a href={portalAPI.getInvoiceUrl(o.id)} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
                style={{ padding: '5px 12px', background: '#f9fafb', border: '1px solid #e5e7eb', color: '#374151', borderRadius: 8, fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
                🧾 Invoice
              </a>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── ACCOUNT TAB ──────────────────────────────────────────────────────── */
function AccountTab({ customer, loyalty, onLogout, onEnablePush, pushEnabled, shops }) {
  const [referral, setReferral]         = useState(null);
  const [showScheduled, setShowSched]   = useState(false);
  const [copyDone, setCopyDone]         = useState(false);

  useEffect(() => {
    portalAPI.getReferral().then(r => setReferral(r.data)).catch(() => {});
  }, []);

  const copyLink = () => {
    if (referral?.shareLink) {
      navigator.clipboard.writeText(referral.shareLink).then(() => {
        setCopyDone(true);
        setTimeout(() => setCopyDone(false), 2000);
      });
    }
  };

  return (
    <div style={{ padding: '18px 16px' }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', marginBottom: 12 }}>Account</div>

      {/* Profile card */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 16, background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', marginBottom: 12 }}>
        <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#16a34a', color: '#fff', fontSize: 20, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {(customer.name || 'C')[0].toUpperCase()}
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{customer.name}</div>
          <div style={{ color: '#888', fontSize: 13 }}>{customer.phone}</div>
          {customer.email && <div style={{ color: '#aaa', fontSize: 12 }}>{customer.email}</div>}
        </div>
      </div>

      {/* Loyalty */}
      {loyalty && (
        <div style={{ background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: 14, padding: 16, marginBottom: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: .6, marginBottom: 6 }}>⭐ Loyalty Points</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#7c3aed' }}>{loyalty.points}</div>
          <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>≈ {fmt(loyalty.rupeeValue)} redeemable value</div>
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>Earn 1 pt per ₹10 · 1 pt = ₹0.50 off</div>
        </div>
      )}

      {/* Referral Program */}
      {referral && (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: 16, marginBottom: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: .6, marginBottom: 8 }}>🤝 Refer & Earn</div>
          <div style={{ fontSize: 13, color: '#555', marginBottom: 8 }}>
            Share your code — you get <strong>{referral.referrerBonus} pts</strong>, they get <strong>{referral.referredBonus} pts</strong>!
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
            <div style={{ flex: 1, background: '#f3f4f6', borderRadius: 8, padding: '8px 12px', fontWeight: 800, fontSize: 16, letterSpacing: 2, color: '#374151', fontFamily: 'monospace' }}>
              {referral.referralCode}
            </div>
            <button onClick={copyLink}
              style={{ padding: '8px 14px', background: copyDone ? '#16a34a' : '#f3f4f6', color: copyDone ? '#fff' : '#374151', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              {copyDone ? '✓ Copied!' : 'Copy'}
            </button>
          </div>
          <div style={{ fontSize: 11, color: '#888' }}>
            {referral.completedReferrals}/{referral.totalReferrals} referrals completed
          </div>
        </div>
      )}

      {/* Scheduled Orders */}
      <div style={{ marginBottom: 12 }}>
        <button style={{ width: '100%', padding: '12px 16px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, textAlign: 'left', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
          onClick={() => setShowSched(s => !s)}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>🗓️ Scheduled Orders</div>
          <span style={{ color: '#9ca3af' }}>{showScheduled ? '▲' : '▼'}</span>
        </button>
        {showScheduled && <ScheduledOrdersPanel shops={shops || []} />}
      </div>

      {/* Push Notifications */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: 16, marginBottom: 12 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: .6, marginBottom: 8 }}>🔔 Push Notifications</div>
        {pushEnabled ? (
          <div style={{ fontSize: 13, color: '#16a34a', fontWeight: 600 }}>✅ Enabled — you'll get order updates</div>
        ) : (
          <>
            <div style={{ fontSize: 13, color: '#555', marginBottom: 8 }}>Get notified on order status & offers</div>
            <button style={{ ...css.btnPrimary, marginTop: 0 }} onClick={onEnablePush}>Enable Notifications</button>
          </>
        )}
      </div>

      <button style={{ ...css.btnPrimary, background: '#f3f4f6', color: '#111' }} onClick={onLogout}>Sign Out</button>
    </div>
  );
}

/* ── MAIN APP ─────────────────────────────────────────────────────────── */
export default function CustomerPortal() {
  const [customer, setCustomer] = useState(() => {
    try { return JSON.parse(localStorage.getItem('bk_customer_user')); } catch { return null; }
  });
  const [cart, dispatch]              = useReducer(cartReducer, []);
  const [screen, setScreen]           = useState('shops');
  const [tab, setTab]                 = useState('home');
  const [selectedShop, setSelectedShop]     = useState(null);
  const [completedOrder, setCompletedOrder] = useState(null);
  const [trackingOrder, setTrackingOrder]   = useState(null);
  const [reviewOrder, setReviewOrder]       = useState(null);
  const [loyalty, setLoyalty]               = useState(null);
  const [allShops, setAllShops]             = useState([]);
  const [installPrompt, setInstallPrompt]   = useState(null);
  const [pushEnabled, setPushEnabled]       = useState(
    typeof Notification !== 'undefined' && Notification.permission === 'granted'
  );

  useEffect(() => {
    if (!customer) return;
    portalAPI.getLoyalty().then(r => setLoyalty(r.data)).catch(() => {});
    portalAPI.listShops().then(r => setAllShops(r.data)).catch(() => {});
  }, [customer]);

  // PWA install prompt (Chrome/Edge/Android)
  useEffect(() => {
    const handler = e => { e.preventDefault(); setInstallPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // Detect iOS Safari (no beforeinstallprompt — show manual tip instead)
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isInStandaloneMode = window.navigator.standalone === true;
  const showIOSHint = isIOS && !isInStandaloneMode && !localStorage.getItem('bk_ios_hint_dismissed');

  const handleAuth = (user) => {
    localStorage.setItem('bk_customer_user', JSON.stringify(user));
    setCustomer(user);
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem('bk_customer_user');
    setCustomer(null);
    dispatch({ type: 'CLEAR' });
    setScreen('shops'); setTab('home');
  };

  const enablePush = async () => {
    const granted = await requestPushPermission();
    if (!granted) { alert('Please allow notifications in your browser settings.'); return; }
    setPushEnabled(true);
    try { await portalAPI.subscribePush({ endpoint: 'browser', p256dh: 'browser', auth: 'browser' }); } catch {}
  };

  if (!customer) return <AuthScreen onAuth={handleAuth} />;

  const goHome = () => { setScreen('shops'); setTab('home'); dispatch({ type: 'CLEAR' }); };

  const handleReorder = async (reorderData) => {
    // reorderData = { shopId, shopName, items: [{productId, productName, unitPrice, quantity}] }
    const shop = allShops.find(s => s.id === reorderData.shopId)
      || { id: reorderData.shopId, name: reorderData.shopName };
    setSelectedShop(shop);
    dispatch({ type: 'CLEAR' });
    for (const item of reorderData.items) {
      dispatch({ type: 'ADD', product: { id: item.productId, name: item.productName, price: item.unitPrice, stock: 99 } });
    }
    setScreen('checkout');
    setTab('home');
  };

  const installPWA = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const result = await installPrompt.userChoice;
    if (result.outcome === 'accepted') setInstallPrompt(null);
  };

  const renderBody = () => {
    if (screen === 'review' && reviewOrder)
      return <ReviewForm order={reviewOrder}
        onDone={() => { setReviewOrder(null); setTab('orders'); setScreen('orders'); }} />;

    if (screen === 'confirm' && completedOrder)
      return <Confirm order={completedOrder}
        onTrack={() => { setTrackingOrder(completedOrder); setScreen('track'); }}
        onHome={goHome} />;

    if (screen === 'track' && trackingOrder)
      return <Track order={trackingOrder}
        onBack={() => { setTab('orders'); setScreen('orders'); }}
        onReview={o => { setReviewOrder(o); setScreen('review'); }} />;

    if (tab === 'orders')
      return <OrderHistory
        onTrack={o => { setTrackingOrder(o); setScreen('track'); }}
        onReorder={handleReorder} />;

    if (tab === 'account')
      return <AccountTab customer={customer} loyalty={loyalty} onLogout={logout}
        onEnablePush={enablePush} pushEnabled={pushEnabled} shops={allShops} />;

    if (screen === 'checkout' && selectedShop)
      return <Checkout shop={selectedShop} cart={cart} dispatch={dispatch} customer={customer}
        onBack={() => setScreen('products')}
        onPlaced={o => {
          setCompletedOrder(o);
          setScreen('confirm');
          portalAPI.getLoyalty().then(r => setLoyalty(r.data)).catch(() => {});
        }} />;

    if (screen === 'products' && selectedShop)
      return <ProductList shop={selectedShop} cart={cart} dispatch={dispatch}
        onBack={() => { setScreen('shops'); dispatch({ type: 'CLEAR' }); }}
        onCheckout={() => setScreen('checkout')} />;

    return <ShopList onSelect={s => { setSelectedShop(s); setScreen('products'); dispatch({ type: 'CLEAR' }); }} />;
  };

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f9fafb', fontFamily: 'system-ui,sans-serif', position: 'relative' }}>
      {/* PWA install banner — Chrome/Android/Edge */}
      {installPrompt && (
        <div style={{ background: '#16a34a', color: '#fff', padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
          <span>📱 Install BizKart app</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={installPWA} style={{ padding: '4px 12px', background: '#fff', color: '#16a34a', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Install</button>
            <button onClick={() => setInstallPrompt(null)} style={{ padding: '4px 8px', background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,.4)', borderRadius: 8, fontSize: 11, cursor: 'pointer' }}>✕</button>
          </div>
        </div>
      )}
      {/* iOS Safari install hint */}
      {!installPrompt && showIOSHint && (
        <div style={{ background: '#1d4ed8', color: '#fff', padding: '10px 16px', fontSize: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <span>📱 Tap <strong>Share ↑</strong> then <strong>"Add to Home Screen"</strong> to install BizKart</span>
          <button onClick={() => { localStorage.setItem('bk_ios_hint_dismissed', '1'); window.location.reload(); }}
            style={{ flexShrink: 0, padding: '3px 8px', background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,.4)', borderRadius: 7, fontSize: 11, cursor: 'pointer' }}>✕</button>
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 16px', background: '#fff', borderBottom: '1px solid #e5e7eb', position: 'sticky', top: 0, zIndex: 10 }}>
        <span style={{ fontWeight: 800, fontSize: 18, color: '#1a1a1a' }}>🛒 BizKart</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {loyalty && loyalty.points > 0 && (
            <span style={{ fontSize: 11, background: '#faf5ff', color: '#7c3aed', fontWeight: 700, padding: '3px 8px', borderRadius: 20, border: '1px solid #e9d5ff' }}>
              ⭐ {loyalty.points} pts
            </span>
          )}
          <span style={{ fontSize: 12, color: '#888' }}>Hi, {(customer.name || '').split(' ')[0]}</span>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 72 }}>{renderBody()}</div>

      {screen !== 'confirm' && screen !== 'review' && (
        <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, display: 'flex', background: '#fff', borderTop: '1px solid #e5e7eb', zIndex: 20 }}>
          {[['home', '🏪', 'Home'], ['orders', '📦', 'Orders'], ['account', '👤', 'Account']].map(([t, e, l]) => (
            <button key={t} onClick={() => { setTab(t); if (t === 'home') setScreen('shops'); else setScreen(t); }}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px 0 8px', border: 'none', background: 'transparent', cursor: 'pointer', color: tab === t ? '#16a34a' : '#9ca3af', gap: 2, fontSize: 11, fontWeight: tab === t ? 700 : 400 }}>
              <span style={{ fontSize: 20 }}>{e}</span>{l}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── STYLES ───────────────────────────────────────────────────────────── */
const css = {
  authWrap:    { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#f0fdf4,#eff6ff)', padding: 16 },
  authCard:    { width: '100%', maxWidth: 400, background: '#fff', borderRadius: 20, padding: 32, boxShadow: '0 20px 60px rgba(0,0,0,.08)' },
  tabRow:      { display: 'flex', gap: 4, background: '#f3f4f6', borderRadius: 10, padding: 4, marginBottom: 18 },
  tabBtn:      { flex: 1, padding: '8px 0', border: 'none', borderRadius: 8, background: 'transparent', cursor: 'pointer', fontSize: 14, fontWeight: 500, color: '#6b7280' },
  tabActive:   { background: '#fff', fontWeight: 700, color: '#111', boxShadow: '0 1px 4px rgba(0,0,0,.1)' },
  input:       { width: '100%', padding: '10px 13px', border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: 14, outline: 'none', boxSizing: 'border-box', background: '#fff', color: '#111' },
  err:         { background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: 10, padding: '9px 13px', fontSize: 12, marginBottom: 10 },
  btnPrimary:  { width: '100%', padding: '13px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer', marginTop: 8 },
  searchBar:   { width: '100%', padding: '12px 16px', border: 'none', borderBottom: '1px solid #e5e7eb', fontSize: 14, outline: 'none', background: '#fff', color: '#111', boxSizing: 'border-box' },
  shopCard:    { display: 'flex', alignItems: 'center', gap: 12, padding: 14, background: '#fff', borderRadius: 14, marginBottom: 8, border: '1px solid #e5e7eb', cursor: 'pointer' },
  shopIcon:    { width: 44, height: 44, borderRadius: 12, background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 },
  topbar:      { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: '#fff', borderBottom: '1px solid #e5e7eb', position: 'sticky', top: 0, zIndex: 5 },
  backBtn:     { padding: '6px 12px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#f9fafb', cursor: 'pointer', fontSize: 13, color: '#374151' },
  iconBtn:     { padding: '6px 10px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#f9fafb', cursor: 'pointer', fontSize: 16 },
  chip:        { flexShrink: 0, padding: '5px 13px', border: '1.5px solid #e5e7eb', borderRadius: 20, fontSize: 12, cursor: 'pointer', background: '#fff', color: '#6b7280', fontWeight: 500 },
  chipActive:  { background: '#16a34a', color: '#fff', borderColor: '#16a34a', fontWeight: 700 },
  productCard: { background: '#fff', borderRadius: 13, padding: 13, border: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', gap: 3 },
  addBtn:      { padding: '7px 0', background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: 8, color: '#15803d', fontWeight: 700, fontSize: 12, cursor: 'pointer' },
  qBtn:        { width: 28, height: 28, borderRadius: 7, border: '1.5px solid #e5e7eb', background: '#f9fafb', fontSize: 15, cursor: 'pointer', fontWeight: 700, color: '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  qBtnSm:      { width: 24, height: 24, borderRadius: 6, border: '1px solid #e5e7eb', background: '#f9fafb', fontSize: 14, cursor: 'pointer', fontWeight: 700, color: '#374151' },
  cartBar:     { position: 'sticky', bottom: 64, left: 0, right: 0, margin: '0 14px 8px', padding: '12px 18px', background: '#16a34a', borderRadius: 13, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', fontWeight: 700, fontSize: 13, boxShadow: '0 4px 16px rgba(22,163,74,.4)' },
  optCard:     { flex: 1, border: '2px solid #e5e7eb', borderRadius: 12, padding: '11px 7px', textAlign: 'center', cursor: 'pointer', background: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 },
  optSel:      { border: '2px solid #16a34a', background: '#f0fdf4' },
};
