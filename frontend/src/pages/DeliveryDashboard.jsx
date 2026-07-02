import React, { useEffect, useState, useCallback, useRef } from 'react';
import { onlineOrderAPI } from '../services/api';

const SC = {
  PLACED:           { l:'New Order',        c:'#3b82f6', bg:'#eff6ff' },
  CONFIRMED:        { l:'Confirmed',         c:'#10b981', bg:'#f0fdf4' },
  PREPARING:        { l:'Preparing',         c:'#f59e0b', bg:'#fffbeb' },
  READY:            { l:'Ready for Pickup',  c:'#8b5cf6', bg:'#faf5ff' },
  OUT_FOR_DELIVERY: { l:'Out for Delivery',  c:'#f97316', bg:'#fff7ed' },
  DELIVERED:        { l:'Delivered',         c:'#10b981', bg:'#f0fdf4' },
  PICKED_UP:        { l:'Picked Up',         c:'#10b981', bg:'#f0fdf4' },
  CANCELLED:        { l:'Cancelled',         c:'#ef4444', bg:'#fef2f2' },
};

const COLS = [
  { id:'new',      label:'New Orders', statuses:['PLACED'],                     color:'#3b82f6', bg:'#eff6ff' },
  { id:'prep',     label:'Preparing',  statuses:['CONFIRMED','PREPARING'],      color:'#f59e0b', bg:'#fffbeb' },
  { id:'outready', label:'Out / Ready',statuses:['OUT_FOR_DELIVERY','READY'],   color:'#f97316', bg:'#fff7ed' },
  { id:'done',     label:'Done Today', statuses:['DELIVERED','PICKED_UP'],      color:'#10b981', bg:'#f0fdf4' },
];

const fmt = v => '₹' + Number(v||0).toLocaleString('en-IN', { minimumFractionDigits:2 });
const ago  = iso => { const m=Math.floor((Date.now()-new Date(iso))/60000); return m<1?'just now':m<60?`${m}m ago`:`${Math.floor(m/60)}h ago`; };

/* ── DEMO DATA ── */
let LIVE = [
  { id:1001, orderNumber:'ONL-1001', orderType:'DELIVERY', status:'PLACED',
    customerAccount:{name:'Ravi Kumar',phone:'9876543210'}, deliveryAddressText:'Flat 4B, Banjara Hills, Hyd',
    paymentMethod:'COD', paymentStatus:'PENDING', totalAmount:534,
    items:[{productName:'Tata Salt 1kg',quantity:2,subtotal:48},{productName:'Amul Butter 500g',quantity:1,subtotal:275}],
    customerNotes:'Ring bell twice', createdAt:new Date(Date.now()-4*60000).toISOString(),
    statusHistory:[{status:'PLACED',createdAt:new Date(Date.now()-4*60000).toISOString(),note:'Order received'}] },
  { id:1002, orderNumber:'ONL-1002', orderType:'PICKUP', status:'CONFIRMED',
    customerAccount:{name:'Priya Sharma',phone:'9876543211'}, deliveryAddressText:null,
    paymentMethod:'UPI', paymentStatus:'PAID', totalAmount:315,
    items:[{productName:'Fortune Oil 1L',quantity:2,subtotal:280}],
    customerNotes:'', createdAt:new Date(Date.now()-12*60000).toISOString(), statusHistory:[] },
  { id:1003, orderNumber:'ONL-1003', orderType:'DELIVERY', status:'OUT_FOR_DELIVERY',
    customerAccount:{name:'Sanjay Reddy',phone:'9876543212'}, deliveryAddressText:'12-1-456, Jubilee Hills, Hyd',
    paymentMethod:'CARD', paymentStatus:'PAID', totalAmount:779,
    items:[{productName:'Basmati Rice 5kg',quantity:1,subtotal:450},{productName:'Fortune Oil 1L',quantity:2,subtotal:280}],
    customerNotes:'', assignedAgent:'Ramu · 9123456780', createdAt:new Date(Date.now()-35*60000).toISOString(), statusHistory:[] },
  { id:1004, orderNumber:'ONL-1004', orderType:'DELIVERY', status:'DELIVERED',
    customerAccount:{name:'Meena Rao',phone:'9876543213'}, deliveryAddressText:'Madhapur, Hyd',
    paymentMethod:'UPI', paymentStatus:'PAID', totalAmount:113,
    items:[{productName:'Tata Salt 1kg',quantity:1,subtotal:24}],
    customerNotes:'', createdAt:new Date(Date.now()-70*60000).toISOString(), statusHistory:[] },
];
let demoIdCtr = 1004;

function demoUpdate(id, status, note) {
  const o = LIVE.find(x => x.id===id); if(!o) return;
  o.status = status;
  o.statusHistory = [...(o.statusHistory||[]), {status, createdAt:new Date().toISOString(), note}];
}

/* ── ACTION BUTTONS ── */
function ActionBtns({ order, onAction }) {
  const [agent, setAgent] = useState('');
  const [showAgent, setShowAgent] = useState(false);

  const act = (s, note) => { onAction(order.id, s, note||SC[s]?.l||''); setShowAgent(false); };

  const btns = [];
  if (order.status==='PLACED') {
    btns.push(<button key="c" style={btnS('#16a34a','#fff')} onClick={() => act('CONFIRMED','Accepted')}>✓ Accept</button>);
    btns.push(<button key="r" style={btnS('#fff','#ef4444','#fecaca')} onClick={() => act('CANCELLED','Rejected')}>✕ Reject</button>);
  }
  if (order.status==='CONFIRMED') btns.push(<button key="p" style={btnS('#f59e0b','#fff')} onClick={() => act('PREPARING','Started prep')}>👨‍🍳 Start Prep</button>);
  if (order.status==='PREPARING') {
    if (order.orderType==='DELIVERY') {
      if (showAgent) {
        btns.push(
          <div key="af" style={{ display:'flex', gap:5 }} onClick={e => e.stopPropagation()}>
            <input style={{ flex:1, padding:'5px 9px', border:'1px solid #e5e7eb', borderRadius:7, fontSize:12, color:'#111' }}
              placeholder="Agent name + phone" value={agent} onChange={e => setAgent(e.target.value)} />
            <button style={btnS('#f97316','#fff')} onClick={() => act('OUT_FOR_DELIVERY', `Assigned to: ${agent||'Agent'}`)}>Send 🛵</button>
          </div>
        );
      } else {
        btns.push(<button key="d" style={btnS('#f97316','#fff')} onClick={e => { e.stopPropagation(); setShowAgent(true); }}>🛵 Assign & Dispatch</button>);
      }
    } else {
      btns.push(<button key="rd" style={btnS('#8b5cf6','#fff')} onClick={() => act('READY','Ready for pickup')}>📦 Mark Ready</button>);
    }
  }
  if (order.status==='READY')            btns.push(<button key="pu" style={btnS('#10b981','#fff')} onClick={() => act('PICKED_UP','Picked up')}>🤝 Picked Up</button>);
  if (order.status==='OUT_FOR_DELIVERY') btns.push(<button key="dl" style={btnS('#10b981','#fff')} onClick={() => act('DELIVERED','Delivered')}>✓ Delivered</button>);

  return btns.length > 0 ? <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:7 }}>{btns}</div> : null;
}
const btnS = (bg,color,border) => ({ padding:'6px 13px', background:bg, color, border:`1px solid ${border||bg}`, borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer' });

/* ── ORDER CARD (board) ── */
function BoardCard({ order, onAction, onSelect }) {
  const urgent = order.status==='PLACED' && (Date.now()-new Date(order.createdAt))/60000 > 5;
  return (
    <div style={{ background:'#fff', border:`1px solid ${urgent?'#fca5a5':'#e5e7eb'}`, borderRadius:11, padding:'11px 13px', marginBottom:7, cursor:'pointer', borderLeft:`4px solid ${SC[order.status]?.c||'#9ca3af'}` }}
      onClick={() => onSelect(order)}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
        <span style={{ fontSize:10, fontWeight:700, color:'#9ca3af' }}>{order.orderNumber}{urgent&&<span style={{ marginLeft:5, fontSize:9, background:'#fef2f2', color:'#b91c1c', padding:'1px 5px', borderRadius:3 }}>URGENT</span>}</span>
        <span style={{ fontSize:10, color:'#9ca3af' }}>{ago(order.createdAt)}</span>
      </div>
      <div style={{ fontWeight:700, fontSize:13 }}>{order.customerAccount?.name}</div>
      <div style={{ fontSize:11, color:'#6b7280', margin:'3px 0 6px' }}>{order.customerAccount?.phone} · {fmt(order.totalAmount)}</div>
      <div style={{ display:'flex', gap:5, marginBottom:6, flexWrap:'wrap' }}>
        <span style={{ fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:5, background:order.orderType==='DELIVERY'?'#fef3c7':'#dbeafe', color:order.orderType==='DELIVERY'?'#92400e':'#1e40af' }}>
          {order.orderType==='DELIVERY'?'🛵 Delivery':'🏪 Pickup'}
        </span>
        <span style={{ fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:5, background:order.paymentStatus==='PAID'?'#f0fdf4':'#fff7ed', color:order.paymentStatus==='PAID'?'#15803d':'#c2410c' }}>
          {order.paymentMethod}
        </span>
      </div>
      {order.customerNotes && <div style={{ fontSize:10, background:'#fffbeb', color:'#92400e', padding:'4px 7px', borderRadius:5, marginBottom:6 }}>💬 {order.customerNotes}</div>}
      {order.assignedAgent && <div style={{ fontSize:10, color:'#6b7280', marginBottom:4 }}>🛵 {order.assignedAgent}</div>}
      <ActionBtns order={order} onAction={(id,s,n) => { onAction(id,s,n); }} />
    </div>
  );
}

/* ── DETAIL DRAWER ── */
function Drawer({ order, onClose, onAction }) {
  if (!order) return null;
  return (
    <div style={{ position:'fixed', inset:0, zIndex:100, display:'flex', alignItems:'flex-end', justifyContent:'center', background:'rgba(0,0,0,.45)' }}
      onClick={e => e.target===e.currentTarget && onClose()}>
      <div style={{ width:'100%', maxWidth:640, background:'#fff', borderRadius:'20px 20px 0 0', padding:'22px 22px 32px', maxHeight:'85vh', overflowY:'auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
          <div><div style={{ fontWeight:800, fontSize:16 }}>{order.orderNumber}</div><div style={{ fontSize:11, color:'#888' }}>{new Date(order.createdAt).toLocaleString('en-IN')}</div></div>
          <button onClick={onClose} style={{ background:'#f3f4f6', border:'none', borderRadius:'50%', width:30, height:30, cursor:'pointer', fontSize:16 }}>×</button>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:16 }}>
          {[
            ['Customer', `${order.customerAccount?.name}\n${order.customerAccount?.phone}`],
            ['Type', order.orderType==='DELIVERY'?'🛵 Delivery':'🏪 Pickup'],
            ['Payment', `${order.paymentMethod} · ${order.paymentStatus}`],
            ['Total', fmt(order.totalAmount)],
          ].map(([l,v]) => (
            <div key={l} style={{ background:'#f9fafb', borderRadius:9, padding:'10px 13px' }}>
              <div style={{ fontSize:10, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', marginBottom:3 }}>{l}</div>
              <div style={{ fontSize:13, fontWeight:600, color:'#1a1a1a', whiteSpace:'pre-line' }}>{v}</div>
            </div>
          ))}
        </div>
        {order.deliveryAddressText && <div style={{ background:'#f9fafb', borderRadius:9, padding:'10px 13px', marginBottom:12 }}><div style={{ fontSize:10, fontWeight:700, color:'#6b7280', marginBottom:4 }}>📍 ADDRESS</div><div style={{ fontSize:13 }}>{order.deliveryAddressText}</div></div>}
        {order.customerNotes && <div style={{ background:'#fffbeb', borderRadius:9, padding:'10px 13px', marginBottom:12 }}><div style={{ fontSize:10, fontWeight:700, color:'#92400e', marginBottom:4 }}>💬 NOTE</div><div style={{ fontSize:13 }}>{order.customerNotes}</div></div>}
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:10, fontWeight:700, color:'#6b7280', textTransform:'uppercase', marginBottom:8 }}>Items</div>
          {order.items?.map((it,i) => <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:13, padding:'8px 0', borderBottom:'1px solid #f3f4f6' }}><span>{it.productName} ×{it.quantity}</span><span style={{ fontWeight:600 }}>{fmt(it.subtotal)}</span></div>)}
          <div style={{ display:'flex', justifyContent:'space-between', fontWeight:800, fontSize:15, padding:'10px 0 0' }}><span>Total</span><span>{fmt(order.totalAmount)}</span></div>
        </div>
        <ActionBtns order={order} onAction={(id,s,n) => { onAction(id,s,n); onClose(); }} />
      </div>
    </div>
  );
}

export default function DeliveryDashboard() {
  const [orders, setOrders] = useState([...LIVE]);
  const [view, setView]     = useState('board');
  const [selected, setSelected] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const timerRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const res = await onlineOrderAPI.getActive();
      LIVE = res.data; setOrders([...LIVE]);
    } catch { setOrders([...LIVE]); }
    setLastRefresh(new Date());
  }, []);

  useEffect(() => { load(); timerRef.current = setInterval(load, 30000); return () => clearInterval(timerRef.current); }, [load]);

  const handleAction = useCallback(async (id, status, note) => {
    demoUpdate(id, status, note);
    setOrders([...LIVE]);
    if (selected?.id === id) setSelected(o => o ? {...o, status, statusHistory:[...(o.statusHistory||[]),{status,createdAt:new Date().toISOString(),note}]} : null);
    try { await onlineOrderAPI.updateStatus(id, status, note); } catch {}
  }, [selected]);

  const simNew = () => {
    demoIdCtr++;
    const names = ['Arjun Nair','Divya Singh','Kiran Murthy','Lakshmi Patel'];
    const o = { id:demoIdCtr, orderNumber:`ONL-${demoIdCtr}`, orderType:Math.random()>.5?'DELIVERY':'PICKUP',
      status:'PLACED', customerAccount:{name:names[demoIdCtr%names.length], phone:'9876500000'},
      deliveryAddressText:'New Area, Hyderabad', paymentMethod:['COD','UPI','CARD'][demoIdCtr%3],
      paymentStatus:'PENDING', totalAmount: Math.floor(200+Math.random()*600),
      items:[{productName:'Mixed Items',quantity:2,subtotal:200}],
      customerNotes:'', createdAt:new Date().toISOString(), statusHistory:[{status:'PLACED',createdAt:new Date().toISOString(),note:'Order received'}] };
    LIVE.unshift(o); setOrders([...LIVE]);
  };

  const revenue   = orders.filter(o => ['DELIVERED','PICKED_UP'].includes(o.status)).reduce((s,o)=>s+Number(o.totalAmount||0),0);
  const active    = orders.filter(o => !['DELIVERED','PICKED_UP','CANCELLED','REFUNDED'].includes(o.status)).length;
  const newOrders = orders.filter(o => o.status==='PLACED').length;
  const colOrders = col => orders.filter(o => col.statuses.includes(o.status));

  return (
    <div>
      <div className="page-header" style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:10 }}>
        <div>
          <h1 className="page-title">Delivery Board</h1>
          <p className="page-subtitle">Live · last updated {lastRefresh.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}</p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <div style={{ display:'flex', gap:4, background:'#f3f4f6', borderRadius:10, padding:4 }}>
            {['board','list'].map(v => <button key={v} onClick={() => setView(v)} style={{ padding:'6px 14px', border:'none', borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:600, background:view===v?'#fff':'transparent', color:view===v?'#111':'#6b7280' }}>{v==='board'?'⊞ Board':'☰ List'}</button>)}
          </div>
          <button onClick={load} style={{ padding:'8px 14px', border:'1px solid #e5e7eb', borderRadius:10, background:'#fff', cursor:'pointer', fontSize:13, fontWeight:600 }}>↺ Refresh</button>
          <button onClick={simNew} style={{ padding:'8px 14px', border:'none', background:'#16a34a', color:'#fff', borderRadius:10, cursor:'pointer', fontSize:13, fontWeight:700 }}>+ New Order (Demo)</button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:20 }}>
        {[
          { l:"Today's Revenue", v:fmt(revenue), c:'#10b981', bg:'#f0fdf4' },
          { l:'Active Orders',   v:active,       c:'#3b82f6', bg:'#eff6ff' },
          { l:'New / Waiting',   v:newOrders,    c:'#ef4444', bg:'#fef2f2' },
          { l:'Total Orders',    v:orders.length,c:'#6b7280', bg:'#f9fafb' },
        ].map(s => <div key={s.l} style={{ background:s.bg, borderRadius:12, padding:'13px 15px', border:`1px solid ${s.c}22` }}><div style={{ fontSize:18, fontWeight:800, color:s.c }}>{s.v}</div><div style={{ fontSize:11, color:'#6b7280', marginTop:3 }}>{s.l}</div></div>)}
      </div>

      {view === 'board' ? (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, alignItems:'start' }}>
          {COLS.map(col => {
            const items = colOrders(col);
            return (
              <div key={col.id}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'9px 13px', background:col.bg, borderRadius:'10px 10px 0 0', border:`1px solid ${col.color}33`, borderBottom:'none' }}>
                  <span style={{ fontSize:12, fontWeight:800, color:col.color }}>{col.label}</span>
                  <span style={{ background:col.color, color:'#fff', fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:20 }}>{items.length}</span>
                </div>
                <div style={{ background:'#f9fafb', border:`1px solid ${col.color}22`, borderTop:'none', borderRadius:'0 0 10px 10px', padding:7, minHeight:80 }}>
                  {items.length === 0 ? <div style={{ textAlign:'center', padding:'20px 0', color:'#d1d5db', fontSize:11 }}>No orders</div>
                    : items.map(o => <BoardCard key={o.id} order={o} onAction={handleAction} onSelect={setSelected} />)}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div>
          {orders.map(o => (
            <div key={o.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', background:'#fff', border:'1px solid #e5e7eb', borderRadius:12, padding:'13px 16px', marginBottom:8, borderLeft:`4px solid ${SC[o.status]?.c||'#9ca3af'}`, cursor:'pointer' }}
              onClick={() => setSelected(o)}>
              <div>
                <div style={{ fontWeight:700, fontSize:14 }}>{o.customerAccount?.name} <span style={{ fontWeight:400, color:'#888', fontSize:12 }}>· {o.orderNumber}</span></div>
                <div style={{ fontSize:12, color:'#6b7280', marginTop:3 }}>{o.orderType} · {fmt(o.totalAmount)} · {ago(o.createdAt)}</div>
              </div>
              <span style={{ fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:20, background:SC[o.status]?.bg||'#f3f4f6', color:SC[o.status]?.c||'#374151' }}>{SC[o.status]?.l||o.status}</span>
            </div>
          ))}
        </div>
      )}

      {selected && <Drawer order={selected} onClose={() => setSelected(null)} onAction={handleAction} />}
    </div>
  );
}
