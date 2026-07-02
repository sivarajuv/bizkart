import React, { useState, useEffect } from 'react';
import axios from 'axios';

// See CustomerPortal.jsx for why this is needed in native (Capacitor) builds.
const API_BASE_URL = process.env.REACT_APP_API_URL || '';

const fmt = v => '₹' + Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });

const EMOJI = {
  Essentials: '🧂', Dairy: '🧈', Oils: '🫙', Grains: '🌾', Vegetables: '🥦',
  Health: '🧴', Snacks: '🍫', Medicine: '💊', Pastries: '🥐', Breads: '🍞',
  Grocery: '🛒', Medicines: '💊', Bakery: '🥐', Default: '📦'
};
function getEmoji(cat) { return EMOJI[cat] || '📦'; }

export default function PublicShopPage({ slug }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [search, setSearch]   = useState('');
  const [cat, setCat]         = useState('All');

  useEffect(() => {
    if (!slug) return;
    axios.get(`${API_BASE_URL}/api/public/shops/${slug}`)
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.error || 'Shop not found'))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#f9fafb' }}>
      <div style={{ width: 36, height: 36, border: '3px solid #e5e7eb', borderTop: '3px solid #16a34a', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (error) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#f9fafb', gap: 12 }}>
      <div style={{ fontSize: 48 }}>🏪</div>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: '#374151' }}>{error}</h2>
      <a href="/" style={{ color: '#16a34a' }}>← Go to BizKart</a>
    </div>
  );

  const { shop, byCategory = {}, totalProducts = 0 } = data || {};
  const cats = Object.keys(byCategory);

  // Flatten all products for search
  const allProducts = Object.entries(byCategory).flatMap(([c, ps]) => ps.map(p => ({ ...p, category: c })));
  const filtered = allProducts.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.category.toLowerCase().includes(search.toLowerCase()) ||
    (p.brand || '').toLowerCase().includes(search.toLowerCase())
  );

  const displayByCat = search
    ? { 'Search Results': filtered }
    : cat === 'All' ? byCategory : { [cat]: byCategory[cat] || [] };

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', minHeight: '100vh', background: '#f9fafb', fontFamily: 'system-ui,sans-serif' }}>
      {/* Shop header */}
      <div style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)', color: '#fff', padding: '28px 20px 22px', textAlign: 'center' }}>
        <div style={{ fontSize: 48 }}>🛒</div>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: '8px 0 4px' }}>{shop.name}</h1>
        <div style={{ fontSize: 13, opacity: .85 }}>{shop.businessType}</div>
        {shop.address && <div style={{ fontSize: 12, opacity: .7, marginTop: 4 }}>📍 {shop.address}</div>}
        <div style={{ marginTop: 12, fontSize: 12, opacity: .7 }}>{totalProducts} products available</div>
      </div>

      {/* Search bar */}
      <div style={{ padding: '14px 16px', background: '#fff', borderBottom: '1px solid #e5e7eb' }}>
        <input
          style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: 14, outline: 'none', boxSizing: 'border-box', color: '#111' }}
          placeholder="Search products…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Category chips */}
      {!search && cats.length > 1 && (
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '10px 14px', background: '#fff', borderBottom: '1px solid #e5e7eb' }}>
          {['All', ...cats].map(c => (
            <button key={c} onClick={() => setCat(c)}
              style={{ flexShrink: 0, padding: '5px 13px', border: '1.5px solid', borderRadius: 20, fontSize: 12, cursor: 'pointer', fontWeight: cat === c ? 700 : 400, background: cat === c ? '#16a34a' : '#fff', color: cat === c ? '#fff' : '#6b7280', borderColor: cat === c ? '#16a34a' : '#e5e7eb' }}>
              {c}
            </button>
          ))}
        </div>
      )}

      {/* Products */}
      <div style={{ padding: '12px 14px' }}>
        {Object.entries(displayByCat).map(([category, products]) => (
          <div key={category} style={{ marginBottom: 24 }}>
            {Object.keys(displayByCat).length > 1 && (
              <div style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: .8, marginBottom: 10 }}>
                {getEmoji(category)} {category}
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {(products || []).map(p => (
                <div key={p.id} style={{ background: '#fff', borderRadius: 13, padding: 13, border: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ fontSize: 22 }}>{getEmoji(p.category)}</div>
                  <div style={{ fontWeight: 700, fontSize: 13, lineHeight: 1.3 }}>{p.name}</div>
                  {p.brand && <div style={{ fontSize: 10, color: '#9ca3af' }}>{p.brand}</div>}
                  <div style={{ fontSize: 11, color: '#9ca3af' }}>{p.unit || ''}</div>
                  <div style={{ fontWeight: 800, fontSize: 16, color: '#16a34a', marginTop: 4 }}>{fmt(p.price)}</div>
                  {p.stock === 0 ? (
                    <div style={{ padding: '5px 0', background: '#f9fafb', borderRadius: 8, color: '#9ca3af', fontSize: 11, textAlign: 'center' }}>Out of stock</div>
                  ) : (
                    <a href={`/?shop=${shop.id}`} style={{ padding: '6px 0', background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: 8, color: '#15803d', fontWeight: 700, fontSize: 12, textAlign: 'center', textDecoration: 'none', display: 'block' }}>
                      Order Now
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
        {search && filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>No products matching "{search}"</div>
        )}
      </div>

      {/* Footer */}
      <div style={{ textAlign: 'center', padding: '20px 16px 40px', color: '#9ca3af', fontSize: 12 }}>
        <div>Powered by <a href="/" style={{ color: '#16a34a', fontWeight: 700 }}>BizKart</a></div>
        {shop.phone && <div style={{ marginTop: 4 }}>📞 {shop.phone}</div>}
      </div>
    </div>
  );
}
