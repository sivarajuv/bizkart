import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { LANGUAGES, useLanguage } from '../context/LanguageContext';

export default function Login() {
  const { login } = useAuth();
  const languageContext = useLanguage();
  const currentLanguage = languageContext?.language || localStorage.getItem('kk_language') || 'en';
  const setLanguage = languageContext?.setLanguage || ((value) => localStorage.setItem('kk_language', value));
  const t = languageContext?.t || ((key) => key);
  const [form, setForm] = useState({ shopCode: '', username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!form.username || !form.password) {
      setError('Please enter username and password');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await login(form.shopCode, form.username, form.password);
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid credentials');
    }
    setLoading(false);
  };

  const fillDemo = (role) => {
    const presets = {
      admin: { shopCode: 'freshmart-hyderabad', username: 'admin', password: 'Admin@123' },
      manager: { shopCode: '', username: '', password: '' },
      cashier: { shopCode: '', username: '', password: '' },
    };
    setForm(presets[role]);
    setError('');
  };

  return (
    <div style={styles.bg}>
      <div style={styles.left}>
        <div style={styles.leftInner}>
          <div style={styles.logo}>Store</div>
          <h1 style={styles.brand}>BizKart</h1>
          <p style={styles.tagline}>
            Multi-business management platform with Indian language support, secure business-level access,
            and flexible tools for products, billing, users, and daily operations.
          </p>
          <div style={styles.features}>
            {[
              'Works for grocery stores, retail shops, wholesalers, and service businesses',
              'Business-specific products, billing, reports, and user access',
              'Admin can create and manage multiple businesses from one platform',
              'English, Hindi, Telugu, and Tamil UI support',
              'Flexible setup for different catalogs, workflows, and operations',
            ].map((feature, index) => <div key={index} style={styles.feature}>- {feature}</div>)}
          </div>
          <div style={styles.leftContactCard}>
            <div style={styles.leftContactTitle}>Need access for your business?</div>
            <p style={styles.leftContactText}>
              If you want to start using BizKart for your business, contact us for account setup,
              onboarding, and support.
            </p>
            <a href="tel:7259000552" style={styles.leftContactLink}>
              Call: 7259000552
            </a>
            <a href="mailto:siva82k@gmail.com" style={styles.leftContactLink}>
              Email: siva82k@gmail.com
            </a>
          </div>
        </div>
      </div>

      <div style={styles.right}>
        <div style={styles.formCard}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <h2 style={styles.formTitle}>{t('loginTitle')}</h2>
              <p style={styles.formSub}>{t('loginSubtitle')}</p>
            </div>
            <select className="form-select" style={{ width: 130 }} value={currentLanguage} onChange={(e) => setLanguage(e.target.value)}>
              {LANGUAGES.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}
            </select>
          </div>

          <div style={styles.demoRow}>
            <span style={styles.demoLabel}>Quick demo:</span>
            <button style={styles.demoBtn} onClick={() => fillDemo('admin')}>Super Admin</button>
          </div>

          <form onSubmit={handleLogin}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Business Code</label>
              <div style={styles.inputWrap}>
                <span style={styles.inputIcon}>#</span>
                <input
                  style={styles.input}
                  type="text"
                  placeholder="Optional for SUPER_ADMIN"
                  value={form.shopCode}
                  onChange={(e) => setForm({ ...form, shopCode: e.target.value })}
                  autoFocus
                />
              </div>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>{t('username')}</label>
              <div style={styles.inputWrap}>
                <span style={styles.inputIcon}>U</span>
                <input
                  style={styles.input}
                  type="text"
                  placeholder="Enter username"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                />
              </div>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>{t('password')}</label>
              <div style={styles.inputWrap}>
                <span style={styles.inputIcon}>*</span>
                <input
                  style={{ ...styles.input, paddingRight: 44 }}
                  type={showPass ? 'text' : 'password'}
                  placeholder="Enter password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
                <button type="button" style={styles.eyeBtn} onClick={() => setShowPass((value) => !value)}>
                  {showPass ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            {error && <div style={styles.error}>{error}</div>}

            <button style={{ ...styles.submitBtn, opacity: loading ? 0.7 : 1 }} type="submit" disabled={loading}>
              {loading ? 'Signing in...' : t('signIn')}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

const styles = {
  bg: { display: 'flex', minHeight: '100vh', height: '100vh', overflow: 'hidden', fontFamily: "'DM Sans', sans-serif" },
  left: { flex: '0 0 60%', background: 'linear-gradient(145deg, #0f2419 0%, #1a4a2a 50%, #0f2419 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '28px 36px' },
  leftInner: { maxWidth: 500 },
  logo: { fontSize: 48, marginBottom: 10, color: '#fff', fontWeight: 700, lineHeight: 1 },
  brand: { fontFamily: "'Syne', sans-serif", fontSize: 34, fontWeight: 800, color: '#fff', marginBottom: 8, lineHeight: 1.1 },
  tagline: { fontSize: 15, color: '#a8c5b5', marginBottom: 24, lineHeight: 1.6 },
  features: { display: 'flex', flexDirection: 'column', gap: 10 },
  feature: { color: '#d1e8dc', fontSize: 14, lineHeight: 1.45 },
  leftContactCard: { marginTop: 22, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 16, padding: '16px', backdropFilter: 'blur(8px)' },
  leftContactTitle: { fontFamily: "'Syne', sans-serif", fontSize: 18, fontWeight: 700, color: '#ffffff', marginBottom: 8, lineHeight: 1.2 },
  leftContactText: { fontSize: 13, color: '#d1e8dc', lineHeight: 1.55, marginBottom: 12 },
  leftContactLink: { display: 'block', textDecoration: 'none', color: '#fff3cf', fontSize: 13, fontWeight: 700, marginBottom: 6 },
  right: { flex: '0 0 40%', maxWidth: '40%', background: '#f7f8f5', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' },
  formCard: { width: '100%', maxWidth: 430, background: '#fff', borderRadius: 20, padding: '28px 28px 24px', boxShadow: '0 8px 40px rgba(15,36,25,0.10)', border: '1px solid #e2e8e4' },
  formTitle: { fontFamily: "'Syne', sans-serif", fontSize: 28, fontWeight: 800, color: '#1a2e1f', marginBottom: 6 },
  formSub: { color: '#6b7c6f', fontSize: 14 },
  demoRow: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18, flexWrap: 'wrap' },
  demoLabel: { fontSize: 12, color: '#6b7c6f', fontWeight: 500 },
  demoBtn: { padding: '5px 14px', border: '1.5px solid #e2e8e4', borderRadius: 20, background: '#f7f8f5', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: "'DM Sans', sans-serif", color: '#1a2e1f' },
  formGroup: { marginBottom: 14 },
  label: { display: 'block', fontSize: 13, fontWeight: 500, color: '#1a2e1f', marginBottom: 6 },
  inputWrap: { position: 'relative' },
  inputIcon: { position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: '#6b7c6f' },
  input: { width: '100%', padding: '11px 14px 11px 40px', border: '1.5px solid #e2e8e4', borderRadius: 10, fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: '#1a2e1f', outline: 'none', boxSizing: 'border-box', background: '#fafbfa' },
  eyeBtn: { position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#1a2e1f' },
  error: { background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 16 },
  submitBtn: { width: '100%', padding: '13px', background: '#1a7a4a', color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", marginTop: 2 },
};
