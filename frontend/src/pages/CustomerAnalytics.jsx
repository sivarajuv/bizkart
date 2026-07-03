import React, { useState, useEffect } from 'react';
import api from '../services/api';

const fmt = v => '₹' + Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });

export default function CustomerAnalytics() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]         = useState('top');

  useEffect(() => {
    api.get('/api/admin/analytics/customers')
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
      <div style={{ width: 36, height: 36, border: '3px solid #e5e7eb', borderTop: '3px solid #16a34a', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  const { summary = {}, topCustomers = [], ordersByHour = {}, churnRisk = [] } = data || {};

  const HOURS = Array.from({ length: 24 }, (_, i) => i);
  const maxCount = Math.max(...Object.values(ordersByHour), 1);

  return (
    <div style={{ padding: '24px 24px 40px', maxWidth: 1000 }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: '#111', margin: '0 0 4px' }}>📊 Customer Analytics</h1>
      <p style={{ color: '#6b7280', fontSize: 13, marginBottom: 24 }}>Order behaviour, top spenders, and churn risk</p>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 24 }}>
        {[
          ['Total Customers',  summary.totalCustomers,  '#3b82f6'],
          ['Active Customers', summary.activeCustomers, '#16a34a'],
          ['New This Month',   summary.newThisMonth,    '#f59e0b'],
          ['Churn Risk',       summary.churnRiskCount,  '#ef4444'],
        ].map(([label, val, color]) => (
          <div key={label} style={{ background: '#fff', borderRadius: 14, padding: 18, border: `1px solid #e5e7eb`, borderTop: `3px solid ${color}` }}>
            <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 600, marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color }}>{val ?? '—'}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {[['top', 'Top Customers'], ['hours', 'Peak Hours'], ['churn', 'Churn Risk']].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            style={{ padding: '8px 18px', border: '1px solid #e5e7eb', borderRadius: 20, fontSize: 13, fontWeight: tab === k ? 700 : 400, background: tab === k ? '#16a34a' : '#fff', color: tab === k ? '#fff' : '#374151', cursor: 'pointer' }}>
            {l}
          </button>
        ))}
      </div>

      {/* Top Customers Table */}
      {tab === 'top' && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                {['#', 'Customer', 'Phone', 'Orders', 'Total Spend', 'Last Order'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: .5 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {topCustomers.map((c, idx) => (
                <tr key={c.customerId} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '12px 14px', fontSize: 13, color: '#9ca3af', fontWeight: 700 }}>{idx + 1}</td>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#dcfce7', color: '#16a34a', fontSize: 14, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {c.name[0].toUpperCase()}
                      </div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{c.name}</div>
                    </div>
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 13, color: '#6b7280' }}>{c.phone}</td>
                  <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 700 }}>{c.orderCount}</td>
                  <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 700, color: '#16a34a' }}>{fmt(c.totalSpend)}</td>
                  <td style={{ padding: '12px 14px', fontSize: 12, color: '#6b7280' }}>
                    {c.lastOrderAt ? new Date(c.lastOrderAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                  </td>
                </tr>
              ))}
              {topCustomers.length === 0 && (
                <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>No order data yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Peak Hours chart */}
      {tab === 'hours' && (
        <div style={{ background: '#fff', borderRadius: 14, padding: 24, border: '1px solid #e5e7eb' }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Orders by Hour of Day</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 160 }}>
            {HOURS.map(h => {
              const count = ordersByHour[h] || 0;
              const height = Math.round((count / maxCount) * 130) + 4;
              return (
                <div key={h} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                  <div style={{ fontSize: 9, color: '#9ca3af' }}>{count || ''}</div>
                  <div style={{ width: '100%', height, background: count ? '#16a34a' : '#e5e7eb', borderRadius: '3px 3px 0 0', minHeight: 4, transition: 'height 0.3s' }} />
                  <div style={{ fontSize: 9, color: '#9ca3af' }}>{h % 3 === 0 ? h : ''}</div>
                </div>
              );
            })}
          </div>
          <div style={{ fontSize: 11, color: '#9ca3af', textAlign: 'center', marginTop: 4 }}>Hour (0–23)</div>
        </div>
      )}

      {/* Churn Risk */}
      {tab === 'churn' && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', background: '#fef2f2', borderBottom: '1px solid #fecaca', fontSize: 13, color: '#b91c1c', fontWeight: 600 }}>
            ⚠️ {churnRisk.length} customers haven't ordered in 30+ days
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                {['Customer', 'Phone', 'Total Orders', 'Last Order'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {churnRisk.map(c => (
                <tr key={c.customerId} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '12px 14px', fontWeight: 600, fontSize: 13 }}>{c.name}</td>
                  <td style={{ padding: '12px 14px', fontSize: 13, color: '#6b7280' }}>{c.phone}</td>
                  <td style={{ padding: '12px 14px', fontSize: 13 }}>{c.orderCount}</td>
                  <td style={{ padding: '12px 14px', fontSize: 12, color: '#ef4444' }}>
                    {c.lastOrderAt ? new Date(c.lastOrderAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                  </td>
                </tr>
              ))}
              {churnRisk.length === 0 && (
                <tr><td colSpan={4} style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>No churn risk customers 🎉</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
