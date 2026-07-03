import React, { useState, useEffect } from 'react';
import api from '../services/api';

const couponAPI = {
  list:   ()         => api.get('/api/admin/coupons'),
  create: (data)     => api.post('/api/admin/coupons', data),
  update: (id, data) => api.put(`/api/admin/coupons/${id}`, data),
  toggle: (id)       => api.patch(`/api/admin/coupons/${id}/toggle`),
};

const EMPTY = {
  code: '', description: '', discountType: 'PERCENT', discountValue: '',
  minOrderValue: '', maxDiscount: '', usageLimit: '',
  firstOrderOnly: false, active: true,
  validFrom: '', validUntil: '',
};

export default function Coupons() {
  const [coupons, setCoupons]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [err, setErr]           = useState('');
  const [form, setForm]         = useState(EMPTY);
  const [editing, setEditing]   = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving]     = useState(false);

  const load = () => {
    setLoading(true);
    couponAPI.list()
      .then(r => setCoupons(r.data))
      .catch(e => setErr(e.response?.data?.error || 'Failed to load coupons'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openNew = () => { setForm(EMPTY); setEditing(null); setShowForm(true); };
  const openEdit = (c) => {
    setForm({
      ...c,
      discountValue: c.discountValue ?? '',
      minOrderValue: c.minOrderValue ?? '',
      maxDiscount:   c.maxDiscount   ?? '',
      usageLimit:    c.usageLimit    ?? '',
      validFrom:     c.validFrom ? c.validFrom.slice(0, 16) : '',
      validUntil:    c.validUntil ? c.validUntil.slice(0, 16) : '',
    });
    setEditing(c.id);
    setShowForm(true);
  };

  const save = async () => {
    if (!form.code.trim() || !form.discountValue) {
      alert('Code and discount value are required'); return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        discountValue: Number(form.discountValue),
        minOrderValue: form.minOrderValue !== '' ? Number(form.minOrderValue) : 0,
        maxDiscount:   form.maxDiscount   !== '' ? Number(form.maxDiscount)   : null,
        usageLimit:    form.usageLimit    !== '' ? Number(form.usageLimit)    : null,
        validFrom:     form.validFrom  || null,
        validUntil:    form.validUntil || null,
      };
      if (editing) await couponAPI.update(editing, payload);
      else         await couponAPI.create(payload);
      setShowForm(false);
      load();
    } catch (e) {
      alert(e.response?.data?.error || 'Failed to save coupon');
    } finally { setSaving(false); }
  };

  const toggle = async (id) => {
    try { await couponAPI.toggle(id); load(); } catch {}
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const fmtDate = (s) => {
    if (!s) return '—';
    return new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <div style={{ padding: '24px 24px 40px', maxWidth: 900 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#111', margin: 0 }}>🎁 Coupons & Offers</h1>
          <p style={{ color: '#6b7280', fontSize: 13, margin: '4px 0 0' }}>Manage discount codes, flash sales, and first-order offers</p>
        </div>
        <button onClick={openNew} style={btn.primary}>+ New Coupon</button>
      </div>

      {err && <div style={{ background: '#fef2f2', color: '#b91c1c', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 13 }}>{err}</div>}

      {/* Modal Form */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 20 }}>{editing ? 'Edit Coupon' : 'New Coupon'}</h2>

            <Row label="Coupon Code *">
              <input style={inp} value={form.code} onChange={e => set('code', e.target.value.toUpperCase())} placeholder="SAVE20" />
            </Row>
            <Row label="Description">
              <input style={inp} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Get 20% off on your order" />
            </Row>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={lbl}>Discount Type</label>
                <select style={inp} value={form.discountType} onChange={e => set('discountType', e.target.value)}>
                  <option value="PERCENT">Percentage (%)</option>
                  <option value="FLAT">Flat Amount (₹)</option>
                </select>
              </div>
              <div>
                <label style={lbl}>Discount Value *</label>
                <input style={inp} type="number" min="0" value={form.discountValue} onChange={e => set('discountValue', e.target.value)}
                  placeholder={form.discountType === 'PERCENT' ? '20' : '50'} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={lbl}>Min Order Value (₹)</label>
                <input style={inp} type="number" min="0" value={form.minOrderValue} onChange={e => set('minOrderValue', e.target.value)} placeholder="0" />
              </div>
              {form.discountType === 'PERCENT' && (
                <div>
                  <label style={lbl}>Max Discount (₹)</label>
                  <input style={inp} type="number" min="0" value={form.maxDiscount} onChange={e => set('maxDiscount', e.target.value)} placeholder="Leave blank for unlimited" />
                </div>
              )}
            </div>
            <Row label="Usage Limit (blank = unlimited)">
              <input style={inp} type="number" min="1" value={form.usageLimit} onChange={e => set('usageLimit', e.target.value)} placeholder="e.g. 100" />
            </Row>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={lbl}>Valid From</label>
                <input style={inp} type="datetime-local" value={form.validFrom} onChange={e => set('validFrom', e.target.value)} />
              </div>
              <div>
                <label style={lbl}>Valid Until</label>
                <input style={inp} type="datetime-local" value={form.validUntil} onChange={e => set('validUntil', e.target.value)} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                <input type="checkbox" checked={form.firstOrderOnly} onChange={e => set('firstOrderOnly', e.target.checked)} />
                First-order only
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                <input type="checkbox" checked={form.active} onChange={e => set('active', e.target.checked)} />
                Active
              </label>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowForm(false)} style={btn.ghost}>Cancel</button>
              <button onClick={save} disabled={saving} style={{ ...btn.primary, opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Saving…' : editing ? 'Update Coupon' : 'Create Coupon'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>Loading coupons…</div>
      ) : coupons.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🎁</div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>No coupons yet</div>
          <div style={{ fontSize: 13 }}>Create your first discount code to attract customers</div>
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                {['Code', 'Discount', 'Min Order', 'Usage', 'Valid Until', 'Status', ''].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: .5 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {coupons.map(c => (
                <tr key={c.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: 14 }}>{c.code}</div>
                    {c.description && <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{c.description}</div>}
                    {c.firstOrderOnly && <span style={{ fontSize: 10, background: '#eff6ff', color: '#1d4ed8', padding: '1px 6px', borderRadius: 20, marginTop: 3, display: 'inline-block' }}>First-order only</span>}
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 13 }}>
                    {c.discountType === 'PERCENT'
                      ? <><strong>{c.discountValue}%</strong> off{c.maxDiscount ? ` (max ₹${c.maxDiscount})` : ''}</>
                      : <><strong>₹{c.discountValue}</strong> off</>}
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 13 }}>₹{c.minOrderValue || 0}</td>
                  <td style={{ padding: '12px 14px', fontSize: 13 }}>
                    {c.usedCount}{c.usageLimit ? `/${c.usageLimit}` : ''} used
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 12, color: '#555' }}>{fmtDate(c.validUntil)}</td>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: c.active ? '#dcfce7' : '#f3f4f6', color: c.active ? '#15803d' : '#6b7280' }}>
                      {c.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => openEdit(c)} style={btn.xs}>Edit</button>
                      <button onClick={() => toggle(c.id)} style={{ ...btn.xs, color: c.active ? '#ef4444' : '#16a34a' }}>
                        {c.active ? 'Disable' : 'Enable'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Row({ label, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={lbl}>{label}</label>
      {children}
    </div>
  );
}

const lbl = { display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 };
const inp = { width: '100%', padding: '9px 12px', border: '1.5px solid #e5e7eb', borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box', color: '#111' };

const btn = {
  primary: { padding: '9px 20px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer' },
  ghost:   { padding: '9px 20px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  xs:      { padding: '5px 12px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' },
};
