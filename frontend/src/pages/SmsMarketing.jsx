import React, { useState, useEffect } from 'react';
import axios from 'axios';

const api = axios.create({ baseURL: '' });
api.interceptors.request.use(cfg => {
  const t = localStorage.getItem('kk_token');
  if (t) cfg.headers = { ...cfg.headers, Authorization: `Bearer ${t}` };
  return cfg;
});

const EMPTY = { title: '', message: '', targetType: 'ALL', shopId: null };
const STATUS_COLOR = { DRAFT: '#f59e0b', SENT: '#16a34a', SCHEDULED: '#3b82f6' };
const TARGET_LABELS = { ALL: 'All Customers', ACTIVE: 'Active (60d)', INACTIVE: 'Inactive (60d+)', HIGH_VALUE: 'High Value (top 20%)' };

export default function SmsMarketing() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [form, setForm]           = useState(EMPTY);
  const [editing, setEditing]     = useState(null);
  const [showForm, setShowForm]   = useState(false);
  const [saving, setSaving]       = useState(false);
  const [sending, setSending]     = useState(null);
  const [shops, setShops]         = useState([]);

  const load = async () => {
    setLoading(true);
    try { const r = await api.get('/api/admin/sms-campaigns'); setCampaigns(r.data); } catch {}
    finally { setLoading(false); }
  };
  useEffect(() => {
    load();
    api.get('/api/portal/shops').then(r => setShops(r.data)).catch(() => {});
  }, []);

  const openNew = () => { setForm(EMPTY); setEditing(null); setShowForm(true); };
  const openEdit = c => { setForm({ ...c }); setEditing(c.id); setShowForm(true); };

  const save = async () => {
    if (!form.title.trim() || !form.message.trim()) { alert('Title and message required'); return; }
    setSaving(true);
    try {
      if (editing) await api.put(`/api/admin/sms-campaigns/${editing}`, form);
      else         await api.post('/api/admin/sms-campaigns', form);
      setShowForm(false); load();
    } catch (e) { alert(e.response?.data?.error || 'Failed to save'); }
    finally { setSaving(false); }
  };

  const sendCampaign = async (id) => {
    if (!window.confirm('Send this SMS campaign to all recipients?')) return;
    setSending(id);
    try { await api.post(`/api/admin/sms-campaigns/${id}/send`); load(); }
    catch (e) { alert(e.response?.data?.error || 'Failed to send'); }
    finally { setSending(null); }
  };

  const deleteCampaign = async (id) => {
    if (!window.confirm('Delete this campaign?')) return;
    try { await api.delete(`/api/admin/sms-campaigns/${id}`); load(); } catch {}
  };

  const charCount = (form.message || '').length;
  const smsCount  = Math.ceil(charCount / 160) || 1;

  return (
    <div style={{ padding: '24px 24px 40px', maxWidth: 900 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#111', margin: 0 }}>📣 SMS Marketing</h1>
          <p style={{ color: '#6b7280', fontSize: 13, margin: '4px 0 0' }}>Send bulk SMS campaigns to your customers</p>
        </div>
        <button onClick={openNew} style={{ padding: '9px 20px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
          + New Campaign
        </button>
      </div>

      {/* Note about simulation */}
      <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#92400e', marginBottom: 20 }}>
        ℹ️ SMS delivery is simulated — connect an SMS provider (Twilio, MSG91) for actual sending
      </div>

      {/* Form modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 520, boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 20 }}>{editing ? 'Edit Campaign' : 'New Campaign'}</h2>

            <div style={{ marginBottom: 12 }}>
              <label style={lbl}>Campaign Title</label>
              <input style={inp} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Summer Sale Announcement" />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={lbl}>Target Audience</label>
              <select style={inp} value={form.targetType} onChange={e => setForm(f => ({ ...f, targetType: e.target.value }))}>
                {Object.entries(TARGET_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ ...lbl, display: 'flex', justifyContent: 'space-between' }}>
                <span>Message</span>
                <span style={{ fontWeight: 400, color: charCount > 160 ? '#ef4444' : '#9ca3af' }}>{charCount}/160 · {smsCount} SMS</span>
              </label>
              <textarea style={{ ...inp, minHeight: 100, resize: 'vertical' }}
                value={form.message}
                onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                placeholder="Hi {name}! Special offer at BizKart — use code SAVE20 for 20% off today!" />
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
              <button onClick={() => setShowForm(false)} style={{ padding: '9px 20px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button onClick={save} disabled={saving} style={{ padding: '9px 20px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Saving…' : editing ? 'Update' : 'Create Campaign'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Campaigns list */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>Loading…</div>
      ) : campaigns.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📣</div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>No campaigns yet</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {campaigns.map(c => (
            <div key={c.id} style={{ background: '#fff', borderRadius: 14, padding: '16px 18px', border: '1px solid #e5e7eb' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{c.title}</div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                    {TARGET_LABELS[c.targetType] || c.targetType} · {c.recipientCount} recipients
                  </div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: STATUS_COLOR[c.status] + '20', color: STATUS_COLOR[c.status] }}>
                  {c.status}
                </span>
              </div>
              <div style={{ background: '#f9fafb', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: '#374151', marginBottom: 12 }}>
                {c.message}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {c.status !== 'SENT' && (
                  <>
                    <button onClick={() => openEdit(c)} style={{ padding: '6px 14px', background: '#f3f4f6', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Edit</button>
                    <button onClick={() => sendCampaign(c.id)} disabled={sending === c.id}
                      style={{ padding: '6px 14px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: sending === c.id ? 0.7 : 1 }}>
                      {sending === c.id ? 'Sending…' : '📤 Send Now'}
                    </button>
                  </>
                )}
                {c.status === 'SENT' && c.sentAt && (
                  <div style={{ fontSize: 11, color: '#9ca3af', alignSelf: 'center' }}>
                    Sent on {new Date(c.sentAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </div>
                )}
                <button onClick={() => deleteCampaign(c.id)}
                  style={{ marginLeft: 'auto', padding: '6px 12px', background: '#fef2f2', color: '#ef4444', border: 'none', borderRadius: 7, fontSize: 12, cursor: 'pointer' }}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const lbl = { display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 };
const inp = { width: '100%', padding: '9px 12px', border: '1.5px solid #e5e7eb', borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box', color: '#111' };
