import React, { useEffect, useState } from 'react';
import { orderAPI } from '../services/api';

// POS order status → label the user actually asked for: "Active" (still
// pending/unsettled) vs "Completed/Delivered" vs Cancelled/Refunded.
const STATUS_STYLE = {
  PENDING:   { label: 'Active',    color: '#f59e0b', bg: '#fffbeb' },
  COMPLETED: { label: 'Completed', color: '#10b981', bg: '#f0fdf4' },
  CANCELLED: { label: 'Cancelled', color: '#ef4444', bg: '#fef2f2' },
  REFUNDED:  { label: 'Refunded',  color: '#6b7280', bg: '#f3f4f6' },
};

const fmt = v => '₹' + Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });

export default function OrderDetailsModal({ orderId, onClose }) {
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    orderAPI.getById(orderId)
      .then(res => { if (!cancelled) setOrder(res.data); })
      .catch(() => { if (!cancelled) setError('Could not load order details.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [orderId]);

  const s = order ? (STATUS_STYLE[order.status] || {}) : {};

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-compact">
        <div className="modal-header">
          <div>
            <h2 className="modal-title modal-title-no-margin">{order?.orderNumber || 'Order Details'}</h2>
            {order && <p className="modal-subtitle">{new Date(order.createdAt).toLocaleString('en-IN')}</p>}
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {loading && <div className="loading-dots"><span /><span /><span /></div>}
        {error && <p style={{ color: '#ef4444', fontSize: 13 }}>{error}</p>}

        {order && !loading && (
          <div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
              <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 20, background: s.bg || '#f3f4f6', color: s.color || '#374151' }}>
                {s.label || order.status}
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 20, background: '#eff6ff', color: '#1e40af' }}>
                {order.paymentMethod}
              </span>
              {order.paymentStatus && (
                <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 20, background: '#f3f4f6', color: '#374151' }}>
                  {order.paymentStatus}
                </span>
              )}
            </div>

            <div style={{ marginBottom: 16, fontSize: 13 }}>
              <div style={{ fontWeight: 700 }}>{order.customerName || 'Walk-in Customer'}</div>
              {order.customerPhone && <div style={{ color: 'var(--text-muted)' }}>{order.customerPhone}</div>}
            </div>

            <div style={{ marginBottom: 16 }}>
              {order.items?.map((it, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                  <span>{it.product?.name || 'Item'} × {it.quantity}</span>
                  <span style={{ fontWeight: 600 }}>{fmt(it.subtotal)}</span>
                </div>
              ))}
              {(!order.items || order.items.length === 0) && (
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No items recorded.</p>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 13 }}>
              <div style={{ color: 'var(--text-muted)' }}>Total</div>
              <div style={{ textAlign: 'right', fontWeight: 700 }}>{fmt(order.totalAmount)}</div>
              <div style={{ color: 'var(--text-muted)' }}>Paid</div>
              <div style={{ textAlign: 'right' }}>{fmt(order.amountPaid)}</div>
              <div style={{ color: 'var(--text-muted)' }}>Balance Due</div>
              <div style={{ textAlign: 'right' }}>{fmt(order.balanceDue)}</div>
            </div>
          </div>
        )}

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
