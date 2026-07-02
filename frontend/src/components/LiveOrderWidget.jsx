/**
 * LiveOrderWidget.jsx
 * Shows real-time online order stats on the admin Dashboard.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { onlineOrderAPI } from '../services/api';

const fmt = v => '₹' + Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });

function sendWhatsApp(phone, order) {
  const clean = phone.replace(/\D/g, '');
  const num = clean.startsWith('91') ? clean : '91' + clean;
  const lines = [
    `🛒 *New Order Received!*`,
    `Order: ${order.orderNumber}`,
    `Customer: ${order.customerAccount?.name} (${order.customerAccount?.phone})`,
    `Type: ${order.orderType === 'DELIVERY' ? '🛵 Home Delivery' : '🏪 Pickup'}`,
    `Total: ₹${order.totalAmount}`,
    `Payment: ${order.paymentMethod}`,
    order.deliveryAddressText ? `Address: ${order.deliveryAddressText}` : '',
  ].filter(Boolean).join('\n');
  window.open(`https://wa.me/${num}?text=${encodeURIComponent(lines)}`, '_blank');
}

export default function LiveOrderWidget() {
  const [orders, setOrders]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [expanded, setExpanded] = useState(true);
  const waPhone = localStorage.getItem('bk_wa_phone') || '';

  const load = useCallback(async () => {
    try {
      const res = await onlineOrderAPI.getActive();
      setOrders(res.data || []);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  const STATUS_COLOR = { PLACED:'#3b82f6', CONFIRMED:'#10b981', PREPARING:'#f59e0b', READY:'#8b5cf6', OUT_FOR_DELIVERY:'#f97316' };
  const STATUS_LABEL = { PLACED:'New', CONFIRMED:'Confirmed', PREPARING:'Preparing', READY:'Ready', OUT_FOR_DELIVERY:'Delivering' };

  const stats = {
    new:      orders.filter(o => o.status === 'PLACED').length,
    active:   orders.filter(o => ['CONFIRMED','PREPARING'].includes(o.status)).length,
    outgoing: orders.filter(o => ['OUT_FOR_DELIVERY','READY'].includes(o.status)).length,
    revenue:  orders.reduce((s, o) => s + Number(o.totalAmount || 0), 0),
  };

  if (loading) return null;

  return (
    <div style={S.card}>
      <div style={S.cardHeader} onClick={() => setExpanded(e => !e)}>
        <span style={S.cardTitle}>
          📦 Online Orders — Live
          {stats.new > 0 && <span style={S.badge}>{stats.new} NEW</span>}
        </span>
        <span style={{ fontSize:12, color:'#9ca3af', cursor:'pointer' }}>{expanded ? '▲ Hide' : '▼ Show'}</span>
      </div>

      <div style={S.statsRow}>
        {[
          { l:'New',       v: stats.new,      c:'#3b82f6', bg:'#eff6ff' },
          { l:'Preparing', v: stats.active,   c:'#f59e0b', bg:'#fffbeb' },
          { l:'Outgoing',  v: stats.outgoing, c:'#f97316', bg:'#fff7ed' },
          { l:'Revenue',   v: fmt(stats.revenue), c:'#10b981', bg:'#f0fdf4' },
        ].map(s => (
          <div key={s.l} style={{ ...S.statBox, background:s.bg, border:`1px solid ${s.c}22` }}>
            <div style={{ fontSize:18, fontWeight:800, color:s.c }}>{s.v}</div>
            <div style={{ fontSize:10, color:'#6b7280', marginTop:2 }}>{s.l}</div>
          </div>
        ))}
      </div>

      {expanded && orders.length === 0 && (
        <div style={{ textAlign:'center', padding:'16px 0', color:'#9ca3af', fontSize:13 }}>No active online orders</div>
      )}

      {expanded && orders.map(o => (
        <div key={o.id} style={{ ...S.orderRow, borderLeft:`3px solid ${STATUS_COLOR[o.status]||'#e5e7eb'}` }}>
          <div style={{ flex:1 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3, flexWrap:'wrap' }}>
              <span style={{ fontSize:12, fontWeight:700 }}>{o.orderNumber}</span>
              <span style={{ fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:10, background:`${STATUS_COLOR[o.status]||'#9ca3af'}22`, color:STATUS_COLOR[o.status]||'#374151' }}>
                {STATUS_LABEL[o.status]||o.status}
              </span>
              <span style={{ fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:10, background:o.orderType==='DELIVERY'?'#fef3c7':'#dbeafe', color:o.orderType==='DELIVERY'?'#92400e':'#1e40af' }}>
                {o.orderType==='DELIVERY'?'🛵 Delivery':'🏪 Pickup'}
              </span>
            </div>
            <div style={{ fontSize:12, color:'#374151', fontWeight:600 }}>
              {o.customerAccount?.name} · {fmt(o.totalAmount)}
            </div>
            <div style={{ fontSize:11, color:'#9ca3af', marginTop:2 }}>
              {o.customerAccount?.phone} · {o.paymentMethod}
              {o.deliveryAddressText && ` · ${o.deliveryAddressText.slice(0,35)}…`}
            </div>
          </div>
          {waPhone && (
            <button onClick={() => sendWhatsApp(waPhone, o)}
              style={{ padding:'5px 10px', background:'#25d366', border:'none', borderRadius:7, color:'#fff', fontSize:11, fontWeight:700, cursor:'pointer', flexShrink:0 }}>
              📱 WA
            </button>
          )}
        </div>
      ))}

      <div style={{ fontSize:11, color:'#9ca3af', paddingTop:8, textAlign:'right' }}>Auto-refreshes every 30s</div>
    </div>
  );
}

const S = {
  card:       { background:'#fff', border:'1px solid #e5e7eb', borderRadius:14, padding:'18px 20px', marginBottom:20 },
  cardHeader: { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14, cursor:'pointer' },
  cardTitle:  { fontWeight:800, fontSize:15, color:'#1a1a1a', display:'flex', alignItems:'center', gap:8 },
  badge:      { background:'#ef4444', color:'#fff', fontSize:10, fontWeight:800, padding:'2px 8px', borderRadius:20 },
  statsRow:   { display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8, marginBottom:14 },
  statBox:    { borderRadius:10, padding:'10px 12px', textAlign:'center' },
  orderRow:   { display:'flex', alignItems:'center', gap:12, padding:'10px 12px', borderRadius:8, marginBottom:6, background:'#f9fafb' },
};
