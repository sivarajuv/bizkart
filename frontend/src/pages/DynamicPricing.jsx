import React, { useState, useEffect } from 'react';
import api from '../services/api';

const fmt = v => '₹' + Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });

export default function DynamicPricing() {
  const [shops, setShops]     = useState([]);
  const [shopId, setShopId]   = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  useEffect(() => {
    api.get('/api/portal/shops').then(r => setShops(r.data)).catch(() => {});
  }, []);

  const load = async () => {
    setLoading(true); setFetched(false);
    try {
      const url = shopId ? `/api/admin/pricing/suggestions?shopId=${shopId}` : '/api/admin/pricing/suggestions';
      const r   = await api.get(url);
      setResults(r.data);
      setFetched(true);
    } catch (e) {
      alert(e.response?.data?.error || 'Failed to load suggestions');
    } finally { setLoading(false); }
  };

  return (
    <div style={{ padding: '24px 24px 40px', maxWidth: 1000 }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: '#111', margin: '0 0 4px' }}>🏷️ Dynamic Pricing</h1>
      <p style={{ color: '#6b7280', fontSize: 13, marginBottom: 24 }}>AI-powered price suggestions based on stock and demand</p>

      <div style={{ display: 'flex', gap: 12, marginBottom: 24, alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Shop (optional)</label>
          <select value={shopId} onChange={e => setShopId(e.target.value)}
            style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #e5e7eb', borderRadius: 8, fontSize: 14, color: '#111', background: '#fff' }}>
            <option value="">All shops (first 20 products)</option>
            {shops.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <button onClick={load} disabled={loading}
          style={{ padding: '10px 24px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: loading ? 0.7 : 1, flexShrink: 0 }}>
          {loading ? 'Getting suggestions…' : '🤖 Get AI Suggestions'}
        </button>
      </div>

      {loading && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: 20, textAlign: 'center', color: '#16a34a', fontSize: 14 }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>🤖</div>
          Analysing your products with AI... this may take a moment
        </div>
      )}

      {!loading && fetched && results.length === 0 && (
        <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>No active products found</div>
      )}

      {!loading && results.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {results.map(r => (
            <div key={r.productId} style={{ background: '#fff', borderRadius: 14, padding: '18px 20px', border: '1px solid #e5e7eb', display: 'flex', gap: 16 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 2 }}>{r.productName}</div>
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>
                  {r.shopName} · {r.category || 'General'} · Stock: <strong>{r.stock}</strong>
                </div>
                <div style={{ background: '#f0fdf4', borderRadius: 10, padding: '10px 14px', borderLeft: '3px solid #16a34a', fontSize: 13, color: '#374151', lineHeight: 1.5 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#16a34a', display: 'block', marginBottom: 3, textTransform: 'uppercase', letterSpacing: .5 }}>🤖 AI Suggestion</span>
                  {r.suggestion}
                </div>
              </div>
              <div style={{ flexShrink: 0, textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 3 }}>Current price</div>
                <div style={{ fontWeight: 800, fontSize: 20, color: '#111' }}>{fmt(r.currentPrice)}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && !fetched && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#9ca3af' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🏷️</div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Ready for AI pricing insights</div>
          <div style={{ fontSize: 13 }}>Select a shop and click "Get AI Suggestions" to begin</div>
        </div>
      )}
    </div>
  );
}
