import React, { useEffect, useState, useCallback } from 'react';
import { onlineOrderAPI, whatsAppAPI } from '../services/api';

const STATUS_CFG = {
  PLACED:           { label:'New Order',         color:'#3b82f6', bg:'#eff6ff' },
  CONFIRMED:        { label:'Confirmed',          color:'#10b981', bg:'#f0fdf4' },
  PREPARING:        { label:'Preparing',          color:'#f59e0b', bg:'#fffbeb' },
  READY:            { label:'Ready for Pickup',   color:'#8b5cf6', bg:'#faf5ff' },
  OUT_FOR_DELIVERY: { label:'Out for Delivery',   color:'#f97316', bg:'#fff7ed' },
  DELIVERED:        { label:'Delivered',          color:'#10b981', bg:'#f0fdf4' },
  PICKED_UP:        { label:'Picked Up',          color:'#10b981', bg:'#f0fdf4' },
  CANCELLED:        { label:'Cancelled',          color:'#ef4444', bg:'#fef2f2' },
};

const fmt = v => '₹' + Number(v||0).toLocaleString('en-IN', { minimumFractionDigits:2 });
const ago = iso => { const m = Math.floor((Date.now()-new Date(iso))/60000); return m<1?'just now':m<60?`${m}m ago`:`${Math.floor(m/60)}h ago`; };

/* ── DEMO ORDERS for offline preview ── */
const DEMO = [
  { id:1001, orderNumber:'ONL-1001', orderType:'DELIVERY', status:'PLACED',
    customerAccount:{ name:'Ravi Kumar', phone:'9876543210' },
    deliveryAddressText:'Flat 4B, Banjara Hills, Hyd - 500034',
    paymentMethod:'COD', paymentStatus:'PENDING', totalAmount:534,
    items:[{ productName:'Tata Salt 1kg', quantity:2, unitPrice:24, subtotal:48 },{ productName:'Amul Butter 500g', quantity:1, unitPrice:275, subtotal:275 }],
    customerNotes:'Ring bell twice', createdAt: new Date(Date.now()-4*60000).toISOString(),
    statusHistory:[{ status:'PLACED', createdAt: new Date(Date.now()-4*60000).toISOString(), note:'Order received' }] },
  { id:1002, orderNumber:'ONL-1002', orderType:'PICKUP', status:'CONFIRMED',
    customerAccount:{ name:'Priya Sharma', phone:'9876543211' },
    deliveryAddressText:null,
    paymentMethod:'UPI', paymentStatus:'PAID', totalAmount:315,
    items:[{ productName:'Fortune Oil 1L', quantity:2, unitPrice:140, subtotal:280 }],
    customerNotes:'', createdAt: new Date(Date.now()-12*60000).toISOString(),
    statusHistory:[{ status:'PLACED', createdAt: new Date(Date.now()-12*60000).toISOString() },{ status:'CONFIRMED', createdAt: new Date(Date.now()-10*60000).toISOString() }] },
  { id:1003, orderNumber:'ONL-1003', orderType:'DELIVERY', status:'OUT_FOR_DELIVERY',
    customerAccount:{ name:'Sanjay Reddy', phone:'9876543212' },
    deliveryAddressText:'12-1-456, Jubilee Hills, Hyd - 500033',
    paymentMethod:'CARD', paymentStatus:'PAID', totalAmount:779,
    items:[{ productName:'Basmati Rice 5kg', quantity:1, unitPrice:450, subtotal:450 },{ productName:'Fortune Oil 1L', quantity:2, unitPrice:140, subtotal:280 }],
    customerNotes:'', createdAt: new Date(Date.now()-35*60000).toISOString(),
    statusHistory:[] },
];

let liveOrders = [...DEMO];

function StatusBadge({ status }) {
  const c = STATUS_CFG[status] || {};
  return <span style={{ fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:20, background:c.bg||'#f3f4f6', color:c.color||'#374151' }}>{c.label||status}</span>;
}

function OrderCard({ order, onUpdate }) {
  const [open, setOpen] = useState(false);
  const [note, setNote]  = useState('');
  const [busy, setBusy]  = useState(false);
  const [waBusy, setWaBusy] = useState(false);
  const [waErr, setWaErr]   = useState('');
  const active = !['DELIVERED','PICKED_UP','CANCELLED','REFUNDED'].includes(order.status);

  const advance = async (newStatus) => {
    setBusy(true);
    try {
      await onUpdate(order.id, newStatus, note || STATUS_CFG[newStatus]?.label || '');
      setNote('');
    } finally { setBusy(false); }
  };

  const notifyWhatsApp = async (e) => {
    e.stopPropagation();
    setWaErr(''); setWaBusy(true);
    try {
      const res = await whatsAppAPI.getOrderLink(order.id);
      // Opened directly from the click handler (not after an intermediate
      // await-then-open in a different tick) would be ideal for popup
      // blockers, but the link depends on a network response, so most
      // browsers/WebViews still allow this since it's a direct user gesture.
      window.open(res.data.link, '_blank', 'noopener');
    } catch (ex) {
      setWaErr(ex.response?.data?.error || 'Could not build WhatsApp link — is a phone number set for this shop?');
    } finally { setWaBusy(false); }
  };

  const nextActions = () => {
    if (order.status === 'PLACED')     return [{ s:'CONFIRMED', l:'✓ Accept' }, { s:'CANCELLED', l:'✕ Reject', danger:true }];
    if (order.status === 'CONFIRMED')  return [{ s:'PREPARING', l:'👨‍🍳 Start Preparing' }];
    if (order.status === 'PREPARING')  return order.orderType === 'DELIVERY'
      ? [{ s:'OUT_FOR_DELIVERY', l:'🛵 Dispatch' }]
      : [{ s:'READY', l:'📦 Mark Ready' }];
    if (order.status === 'READY')            return [{ s:'PICKED_UP',  l:'🤝 Picked Up' }];
    if (order.status === 'OUT_FOR_DELIVERY') return [{ s:'DELIVERED',  l:'✓ Delivered' }];
    return [];
  };

  return (
    <div style={{ background:'#fff', border:`1px solid ${order.status==='PLACED'&&(Date.now()-new Date(order.createdAt))/60000>5?'#fca5a5':'#e5e7eb'}`, borderRadius:13, marginBottom:10, overflow:'hidden', borderLeft:`4px solid ${STATUS_CFG[order.status]?.color||'#9ca3af'}` }}>
      <div style={{ padding:'13px 16px', cursor:'pointer', display:'flex', alignItems:'flex-start', gap:10 }} onClick={() => setOpen(o => !o)}>
        <div style={{ flex:1 }}>
          <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap', marginBottom:5 }}>
            <span style={{ fontWeight:800, fontSize:13 }}>{order.orderNumber}</span>
            <StatusBadge status={order.status} />
            <span style={{ fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:6, background:order.orderType==='DELIVERY'?'#fef3c7':'#dbeafe', color:order.orderType==='DELIVERY'?'#92400e':'#1e40af' }}>
              {order.orderType==='DELIVERY'?'🛵 Delivery':'🏪 Pickup'}
            </span>
          </div>
          <div style={{ fontWeight:700, fontSize:14, marginBottom:3 }}>{order.customerAccount?.name} · {order.customerAccount?.phone}</div>
          <div style={{ fontSize:12, color:'#9ca3af' }}>{order.items?.length||0} items · {fmt(order.totalAmount)} · {ago(order.createdAt)} · {order.paymentMethod}</div>
        </div>
        <span style={{ color:'#9ca3af' }}>{open?'▲':'▼'}</span>
      </div>
      {open && (
        <div style={{ borderTop:'1px solid #f3f4f6', padding:'13px 16px' }}>
          <div style={{ marginBottom:12 }}>
            {order.items?.map((it,i) => (
              <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:13, padding:'5px 0', borderBottom:'1px solid #f9fafb' }}>
                <span>{it.productName} ×{it.quantity}</span><span style={{ fontWeight:600 }}>{fmt(it.subtotal)}</span>
              </div>
            ))}
          </div>
          {order.deliveryAddressText && <div style={{ background:'#f9fafb', borderRadius:8, padding:'9px 12px', marginBottom:10, fontSize:13 }}>📍 {order.deliveryAddressText}</div>}
          {order.customerNotes && <div style={{ background:'#fffbeb', borderRadius:8, padding:'9px 12px', marginBottom:10, fontSize:13 }}>💬 {order.customerNotes}</div>}

          <button onClick={notifyWhatsApp} disabled={waBusy}
            style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px', marginBottom:10, border:'1px solid #bbf7d0', borderRadius:8, background:'#f0fdf4', color:'#15803d', fontWeight:700, fontSize:13, cursor:'pointer' }}>
            📱 {waBusy ? 'Opening…' : 'Notify via WhatsApp'}
          </button>
          {waErr && <div style={{ color:'#b91c1c', fontSize:12, marginBottom:10 }}>{waErr}</div>}

          {active && (
            <div>
              <input style={{ width:'100%', padding:'8px 12px', border:'1px solid #e5e7eb', borderRadius:8, fontSize:13, boxSizing:'border-box', marginBottom:8, color:'#111' }}
                placeholder="Optional note…" value={note} onChange={e => setNote(e.target.value)} />
              <div style={{ display:'flex', gap:7, flexWrap:'wrap' }}>
                {nextActions().map(a => (
                  <button key={a.s} disabled={busy} onClick={() => advance(a.s)}
                    style={{ padding:'8px 16px', border:`1px solid ${a.danger?'#fecaca':'transparent'}`, borderRadius:8, background:a.danger?'#fff':'#16a34a', color:a.danger?'#ef4444':'#fff', fontWeight:700, fontSize:13, cursor:'pointer' }}>
                    {busy ? 'Updating…' : a.l}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function OnlineOrders() {
  const [orders, setOrders] = useState(liveOrders);
  const [tab, setTab]       = useState('active');
  const [filter, setFilter] = useState('ALL');

  const load = useCallback(async () => {
    try {
      const [activeRes, allRes] = await Promise.all([onlineOrderAPI.getActive(), onlineOrderAPI.getAll()]);
      liveOrders = allRes.data;
      setOrders([...liveOrders]);
    } catch {
      setOrders([...liveOrders]); // demo mode
    }
  }, []);

  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, [load]);

  const handleUpdate = async (id, status, note) => {
    // Demo: update in place
    const o = liveOrders.find(x => x.id === id);
    if (o) { o.status = status; o.statusHistory = [...(o.statusHistory||[]), { status, createdAt: new Date().toISOString(), note }]; }
    setOrders([...liveOrders]);
    try { await onlineOrderAPI.updateStatus(id, status, note); } catch {}
  };

  const active  = orders.filter(o => !['DELIVERED','PICKED_UP','CANCELLED','REFUNDED'].includes(o.status));
  const history = orders.filter(o => filter === 'ALL' || o.status === filter);
  const shown   = tab === 'active' ? active : history;

  const stats = {
    revenue:   orders.filter(o => ['DELIVERED','PICKED_UP'].includes(o.status)).reduce((s,o) => s+Number(o.totalAmount||0),0),
    newOrders: active.filter(o => o.status==='PLACED').length,
    preparing: active.filter(o => ['CONFIRMED','PREPARING'].includes(o.status)).length,
    outgoing:  active.filter(o => ['OUT_FOR_DELIVERY','READY'].includes(o.status)).length,
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Online Orders</h1>
        <p className="page-subtitle">Manage delivery and pickup orders · auto-refreshes every 30s</p>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))', gap:10, marginBottom:20 }}>
        {[
          { l:"Today's Revenue", v:fmt(stats.revenue),  c:'#10b981', bg:'#f0fdf4' },
          { l:'New Orders',      v:stats.newOrders,     c:'#3b82f6', bg:'#eff6ff' },
          { l:'Preparing',       v:stats.preparing,     c:'#f59e0b', bg:'#fffbeb' },
          { l:'En Route/Ready',  v:stats.outgoing,      c:'#f97316', bg:'#fff7ed' },
        ].map(s => (
          <div key={s.l} style={{ background:s.bg, borderRadius:12, padding:'13px 15px', border:`1px solid ${s.c}22` }}>
            <div style={{ fontSize:20, fontWeight:800, color:s.c }}>{s.v}</div>
            <div style={{ fontSize:11, color:'#6b7280', marginTop:3 }}>{s.l}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'flex', gap:4, background:'#f3f4f6', borderRadius:10, padding:4, maxWidth:280, marginBottom:16 }}>
        {['active','history'].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ flex:1, padding:'8px 0', border:'none', borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:600, background:tab===t?'#fff':'transparent', color:tab===t?'#111':'#6b7280', boxShadow:tab===t?'0 1px 3px rgba(0,0,0,.1)':'none' }}>
            {t === 'active' ? `Active (${active.length})` : 'History'}
          </button>
        ))}
      </div>

      {tab === 'history' && (
        <div style={{ display:'flex', gap:7, marginBottom:14, flexWrap:'wrap' }}>
          {['ALL',...Object.keys(STATUS_CFG)].map(s => (
            <button key={s} onClick={() => setFilter(s)} style={{ padding:'5px 12px', borderRadius:20, border:'1px solid #e5e7eb', fontSize:12, cursor:'pointer', fontWeight:600, background:filter===s?'#1a1a1a':'#fff', color:filter===s?'#fff':'#374151' }}>
              {s === 'ALL' ? 'All' : STATUS_CFG[s]?.label||s}
            </button>
          ))}
        </div>
      )}

      {shown.length === 0
        ? <div style={{ textAlign:'center', padding:50, color:'#9ca3af' }}><div style={{ fontSize:36, marginBottom:10 }}>📦</div>No orders to show</div>
        : shown.map(o => <OrderCard key={o.id} order={o} onUpdate={handleUpdate} />)
      }
      <div style={{ textAlign:'center', fontSize:11, color:'#9ca3af', padding:'12px 0' }}>Auto-refreshes every 30 seconds</div>
    </div>
  );
}
