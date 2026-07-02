import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { LANGUAGES, getLanguageLabel, useLanguage } from '../context/LanguageContext';
import {
  DEFAULT_BUSINESS_TYPE,
  DEFAULT_LANGUAGE,
  DEFAULT_PLATFORM_LABEL,
  MANAGEABLE_USER_ROLE_OPTIONS,
  USER_ROLES,
} from '../constants/appConstants';
import { USER_MESSAGES } from '../constants/messages';
import { authAPI, shopAPI, userAPI } from '../services/api';

const BUSINESS_TYPE_OPTIONS = ['Kirana Store', 'Grocery', 'Cement', 'Steel', 'Hardware', 'Construction Materials'];

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Unable to read selected image'));
    reader.readAsDataURL(file);
  });
}

function ShopModal({ shop, onClose, onSave }) {
  const [form, setForm] = useState({
    code: shop?.code || '',
    name: shop?.name || '',
    defaultLanguage: shop?.defaultLanguage || DEFAULT_LANGUAGE,
    businessType: shop?.businessType || DEFAULT_BUSINESS_TYPE,
    ownerName: shop?.ownerName || '',
    phone: shop?.phone || '',
    address: shop?.address || '',
    upiQrImage: shop?.upiQrImage || '',
  });
  const [saving, setSaving] = useState(false);

  const handleUpiImageChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      alert('Please upload an image smaller than 2 MB');
      return;
    }

    try {
      const image = await readFileAsDataUrl(file);
      setForm((current) => ({ ...current, upiQrImage: image }));
    } catch (error) {
      alert(error.message);
    } finally {
      event.target.value = '';
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (shop?.id) {
        await shopAPI.update(shop.id, form);
      } else {
        await shopAPI.create(form);
      }
      onSave();
      onClose();
    } catch (error) {
      alert(error.response?.data?.error || (shop?.id ? USER_MESSAGES.SAVE_USER_ERROR : USER_MESSAGES.CREATE_BUSINESS_ERROR));
    }
    setSaving(false);
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h2 className="modal-title">{shop?.id ? 'Edit Business' : 'Create Business'}</h2>
        <div className="form-group"><label className="form-label">Business Name</label><input className="form-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Business Code</label><input className="form-input" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} disabled={Boolean(shop?.id)} /></div>
          <div className="form-group"><label className="form-label">Default Language</label><select className="form-select" value={form.defaultLanguage} onChange={(e) => setForm({ ...form, defaultLanguage: e.target.value })}>{LANGUAGES.map((language) => <option key={language.code} value={language.code}>{language.label}</option>)}</select></div>
        </div>
        <div className="form-group">
          <label className="form-label">Business Type</label>
          <input className="form-input" list="business-type-options" value={form.businessType} onChange={(e) => setForm({ ...form, businessType: e.target.value })} placeholder="Kirana Store, Cement, Steel, Hardware..." />
          <datalist id="business-type-options">
            {BUSINESS_TYPE_OPTIONS.map((item) => <option key={item} value={item} />)}
          </datalist>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>Starter products are added automatically for supported business types when the catalog is empty.</div>
        </div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Owner Name</label><input className="form-input" value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: e.target.value })} /></div>
          <div className="form-group"><label className="form-label">Phone</label><input className="form-input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
        </div>
        <div className="form-group"><label className="form-label">Address</label><input className="form-input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
        <div className="form-group">
          <label className="form-label">UPI QR Image</label>
          <input className="form-input" type="file" accept="image/*" onChange={handleUpiImageChange} />
          {form.upiQrImage && (
            <div style={{ marginTop: 12 }}>
              <img src={form.upiQrImage} alt="UPI QR" style={{ width: 180, maxWidth: '100%', borderRadius: 12, border: '1px solid var(--border)' }} />
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setForm({ ...form, upiQrImage: '' })}>Remove QR</button>
              </div>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 12 }}><button className="btn btn-secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</button><button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ flex: 2 }}>{saving ? 'Saving...' : shop?.id ? 'Save Business' : 'Create Business'}</button></div>
      </div>
    </div>
  );
}

function UserModal({ user, shops, onClose, onSave }) {
  const hasBusinesses = shops.length > 0;
  const initialRole = user?.role || USER_ROLES.CASHIER;
  const [form, setForm] = useState(user ? {
    fullName: user.fullName,
    email: user.email,
    role: initialRole,
    shopId: user.shop?.id || '',
    password: '',
  } : {
    username: '',
    fullName: '',
    email: '',
    password: '',
    role: initialRole,
    shopId: shops[0]?.id || '',
  });
  const [saving, setSaving] = useState(false);
  const requiresBusiness = form.role !== USER_ROLES.SUPER_ADMIN;
  const roleOptions = form.role === USER_ROLES.SUPER_ADMIN
    ? [USER_ROLES.SUPER_ADMIN, ...MANAGEABLE_USER_ROLE_OPTIONS]
    : MANAGEABLE_USER_ROLE_OPTIONS;

  const handleSave = async () => {
    if (!user && requiresBusiness && !hasBusinesses) {
      alert(USER_MESSAGES.CREATE_BUSINESS_REQUIRED);
      return;
    }
    if (requiresBusiness && !form.shopId) {
      alert(USER_MESSAGES.SELECT_BUSINESS);
      return;
    }
    setSaving(true);
    try {
      if (user) {
        await userAPI.update(user.id, { ...form, shopId: requiresBusiness && form.shopId ? String(form.shopId) : '' });
      } else {
        await userAPI.create({ ...form, shopId: requiresBusiness && form.shopId ? Number(form.shopId) : null });
      }
      onSave();
      onClose();
    } catch (error) {
      alert(error.response?.data?.error || USER_MESSAGES.SAVE_USER_ERROR);
    }
    setSaving(false);
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h2 className="modal-title">{user ? 'Edit User' : 'Create User'}</h2>
        {!user && <div className="form-group"><label className="form-label">Username</label><input className="form-input" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></div>}
        <div className="form-row">
          <div className="form-group"><label className="form-label">Full Name</label><input className="form-input" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></div>
          <div className="form-group"><label className="form-label">Email</label><input className="form-input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Role</label><select className="form-select" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value, shopId: e.target.value === USER_ROLES.SUPER_ADMIN ? '' : (form.shopId || shops[0]?.id || '') })}>{roleOptions.map((role) => <option key={role} value={role}>{role}</option>)}</select></div>
          <div className="form-group">
            <label className="form-label">Business</label>
            <select className="form-select" value={form.shopId} onChange={(e) => setForm({ ...form, shopId: e.target.value })} disabled={!requiresBusiness || !hasBusinesses}>
              <option value="">{hasBusinesses ? 'Select business' : 'No businesses available'}</option>
              {shops.map((shop) => <option key={shop.id} value={shop.id}>{shop.name}</option>)}
            </select>
            {!requiresBusiness && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>Super admins are platform users and do not require a business assignment.</div>}
            {requiresBusiness && !hasBusinesses && <div style={{ fontSize: 12, color: '#b45309', marginTop: 6 }}>{USER_MESSAGES.NO_BUSINESS_HELPER}</div>}
          </div>
        </div>
        <div className="form-group"><label className="form-label">{user ? 'Reset Password' : 'Password'}</label><input className="form-input" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
        <div style={{ display: 'flex', gap: 12 }}><button className="btn btn-secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</button><button className="btn btn-primary" onClick={handleSave} disabled={saving || (requiresBusiness && !hasBusinesses)} style={{ flex: 2 }}>{saving ? 'Saving...' : 'Save User'}</button></div>
      </div>
    </div>
  );
}

function ResetPasswordModal({ user, onClose, onSave }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [saving, setSaving]     = useState(false);
  const [err, setErr]           = useState('');

  const handleSave = async () => {
    setErr('');
    if (password.length < 6) { setErr('Password must be at least 6 characters'); return; }
    if (password !== confirm) { setErr('Passwords do not match'); return; }
    setSaving(true);
    try {
      await userAPI.update(user.id, { password });
      onSave();
      onClose();
    } catch (error) {
      setErr(error.response?.data?.error || USER_MESSAGES.SAVE_USER_ERROR);
    }
    setSaving(false);
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h2 className="modal-title">Reset Password</h2>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: -8, marginBottom: 16 }}>
          Set a new password for <strong>{user.fullName}</strong> (@{user.username}). They will need to sign in with this new password.
        </p>
        <div className="form-group"><label className="form-label">New Password</label><input className="form-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 6 characters" autoFocus /></div>
        <div className="form-group"><label className="form-label">Confirm New Password</label><input className="form-input" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></div>
        {err && <div style={{ background: '#fef2f2', color: '#b91c1c', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 14, border: '1px solid #fecaca' }}>{err}</div>}
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ flex: 2 }}>{saving ? 'Saving...' : 'Reset Password'}</button>
        </div>
      </div>
    </div>
  );
}

export default function Users() {
  const { user: currentUser, isSuperAdmin } = useAuth();
  const { t } = useLanguage();
  const [users, setUsers] = useState([]);
  const [shops, setShops] = useState([]);
  const [editUser, setEditUser] = useState(null);
  const [editShop, setEditShop] = useState(null);
  const [resetPasswordUser, setResetPasswordUser] = useState(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showShopModal, setShowShopModal] = useState(false);

  const load = async () => {
    const usersRes = await userAPI.getAll();
    setUsers(usersRes.data);
    if (isSuperAdmin()) {
      const shopsRes = await shopAPI.getAll();
      setShops(shopsRes.data);
      return;
    }

    if (currentUser?.shop) {
      setShops([currentUser.shop]);
      return;
    }

    try {
      const meRes = await authAPI.me();
      if (meRes.data?.shop) {
        setShops([meRes.data.shop]);
        return;
      }
    } catch (error) {
      // Fall through to derive the business from the scoped user list.
    }

    const scopedShops = usersRes.data
      .map((item) => item.shop)
      .filter((shop, index, list) => shop?.id && list.findIndex((candidate) => candidate?.id === shop.id) === index);
    setShops(scopedShops);
  };

  useEffect(() => {
    load();
  }, []);

  const toggleUserStatus = async (id) => {
    await userAPI.toggleStatus(id);
    load();
  };

  const toggleShopStatus = async (id) => {
    await shopAPI.toggleStatus(id);
    load();
  };

  const deleteShop = async (id, name) => {
    if (window.confirm(USER_MESSAGES.DELETE_BUSINESS_CONFIRM(name))) {
      await shopAPI.delete(id);
      load();
    }
  };

  const deleteUser = async (id, name) => {
    if (window.confirm(USER_MESSAGES.DELETE_USER_CONFIRM(name))) {
      await userAPI.delete(id);
      load();
    }
  };

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 className="page-title">{t('userManagement')}</h1>
            <p className="page-subtitle">Manage businesses, store teams, and multilingual defaults from one shared URL.</p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            {isSuperAdmin() && <button className="btn btn-secondary" onClick={() => setShowShopModal(true)}>{t('addShop')}</button>}
            <button className="btn btn-primary" onClick={() => setShowUserModal(true)}>{t('addUser')}</button>
          </div>
        </div>
      </div>

      <div className="page-content">
        <div className="responsive-four-grid" style={{ marginBottom: 24 }}>
          {[
            { label: 'Businesses', value: shops.length },
            { label: 'Users', value: users.length },
            { label: 'Managers', value: users.filter((item) => item.role === 'MANAGER').length },
            { label: 'Cashiers', value: users.filter((item) => item.role === 'CASHIER').length },
          ].map((item, index) => (
            <div key={index} className="stat-card">
              <div className="stat-label">{item.label}</div>
              <div className="stat-value">{item.value}</div>
            </div>
          ))}
        </div>

        {isSuperAdmin() && (
          <div className="card" style={{ marginBottom: 24 }}>
            <h3 className="chart-title">{t('shopManagement')}</h3>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>{t('shop')}</th>
                    <th>Code</th>
                    <th>Business Type</th>
                    <th>Owner</th>
                    <th>Language</th>
                    <th>UPI QR</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {shops.map((shop) => (
                    <tr key={shop.id}>
                      <td>{shop.name}</td>
                      <td style={{ fontFamily: 'monospace' }}>{shop.code}</td>
                      <td>{shop.businessType || DEFAULT_BUSINESS_TYPE}</td>
                      <td>{shop.ownerName || '—'}</td>
                      <td>{getLanguageLabel(shop.defaultLanguage)}</td>
                      <td><span className={`badge badge-${shop.upiQrImage ? 'success' : 'gray'}`}>{shop.upiQrImage ? 'Uploaded' : 'Missing'}</span></td>
                      <td><span className={`badge badge-${shop.enabled ? 'success' : 'danger'}`}>{shop.enabled ? 'Active' : 'Inactive'}</span></td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => setEditShop(shop)}>Edit</button>
                          <button className="btn btn-secondary btn-sm" onClick={() => toggleShopStatus(shop.id)}>{shop.enabled ? 'Disable' : 'Enable'}</button>
                          <button className="btn btn-danger btn-sm" onClick={() => deleteShop(shop.id, shop.name)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="card">
          <h3 className="chart-title">{t('userManagement')}</h3>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Username</th>
                  <th>{t('shop')}</th>
                  <th>{t('role')}</th>
                  <th>Status</th>
                  <th>Last Login</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>{user.fullName}</td>
                    <td style={{ fontFamily: 'monospace' }}>{user.username}</td>
                    <td>{user.shop?.name || DEFAULT_PLATFORM_LABEL}</td>
                    <td><span className="badge badge-gray">{user.role}</span></td>
                    <td><span className={`badge badge-${user.enabled ? 'success' : 'danger'}`}>{user.enabled ? 'Active' : 'Inactive'}</span></td>
                    <td>{user.lastLogin ? new Date(user.lastLogin).toLocaleString('en-IN') : 'Never'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => setEditUser(user)}>Edit</button>
                        <button className="btn btn-secondary btn-sm" onClick={() => setResetPasswordUser(user)}>Reset Password</button>
                        <button className="btn btn-secondary btn-sm" onClick={() => toggleUserStatus(user.id)} disabled={user.id === currentUser?.id}>{user.enabled ? 'Disable' : 'Enable'}</button>
                        <button className="btn btn-danger btn-sm" onClick={() => deleteUser(user.id, user.fullName)} disabled={user.id === currentUser?.id}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {(showShopModal || editShop) && isSuperAdmin() && <ShopModal shop={editShop} onClose={() => { setShowShopModal(false); setEditShop(null); }} onSave={load} />}
      {(showUserModal || editUser) && <UserModal user={editUser} shops={shops} onClose={() => { setEditUser(null); setShowUserModal(false); }} onSave={load} />}
      {resetPasswordUser && <ResetPasswordModal user={resetPasswordUser} onClose={() => setResetPasswordUser(null)} onSave={load} />}
    </div>
  );
}
