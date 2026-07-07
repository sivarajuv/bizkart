import React, { useEffect, useState } from 'react';
import { customerAPI, orderAPI } from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import LiveOrderWidget from '../components/LiveOrderWidget';
import OrderDetailsModal from '../components/OrderDetailsModal';

const ORDER_STATUS_CFG = {
  PENDING:   { label: 'Active',    color: '#f59e0b', bg: '#fffbeb' },
  COMPLETED: { label: 'Completed', color: '#10b981', bg: '#f0fdf4' },
  CANCELLED: { label: 'Cancelled', color: '#ef4444', bg: '#fef2f2' },
  REFUNDED:  { label: 'Refunded',  color: '#6b7280', bg: '#f3f4f6' },
};

export default function Dashboard({ onNavigate }) {
  const { t } = useLanguage();
  const [stats, setStats] = useState(null);
  const [topProducts, setTopProducts] = useState([]);
  const [allOrders, setAllOrders] = useState([]);
  const [categoryStats, setCategoryStats] = useState([]);
  const [customerSummary, setCustomerSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [orderFilter, setOrderFilter] = useState('ALL');
  const [selectedOrderId, setSelectedOrderId] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [statsRes, topProductsRes, ordersRes, categoriesRes, customerSummaryRes] = await Promise.all([
          orderAPI.getDashboardStats(),
          orderAPI.getTopProducts(),
          orderAPI.getAll(),
          orderAPI.getSalesByCategory(),
          customerAPI.getSummary(),
        ]);
        setStats(statsRes.data);
        setTopProducts(topProductsRes.data.slice(0, 5));
        setAllOrders(ordersRes.data);
        setCategoryStats(categoriesRes.data);
        setCustomerSummary(customerSummaryRes.data);
      } catch (error) {
        console.error(error);
      }
      setLoading(false);
    };
    load();
  }, []);

  const fmt = (value) => value != null ? `₹${Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '₹0.00';

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <div className="loading-dots"><span /><span /><span /></div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">{t('dashboard')}</h1>
        <p className="page-subtitle">{stats?.activeShopName ? `${stats.activeShopName} • ${stats?.businessType || 'Retail'} performance snapshot` : 'Business performance snapshot'}</p>
      </div>

      <LiveOrderWidget />

      <div className="stats-grid">
        {[
          { icon: '📦', label: t('totalOrders'), value: stats?.totalOrders ?? 0, sub: `${stats?.todayOrders ?? 0} today` },
          { icon: '💰', label: t('totalRevenue'), value: fmt(stats?.totalRevenue), sub: `${fmt(stats?.todayRevenue)} today` },
          { icon: '📈', label: 'Gross Profit', value: fmt(stats?.totalProfit), sub: `${fmt(stats?.todayProfit)} today` },
          { icon: '🧾', label: 'Outstanding Credit', value: fmt(stats?.totalOutstanding), sub: `${stats?.creditOrders ?? 0} credit bills` },
        ].map((item, index) => (
          <div key={index} className="stat-card">
            <div className="stat-icon">{item.icon}</div>
            <div className="stat-label">{item.label}</div>
            <div className="stat-value" style={{ fontSize: item.value?.length > 18 ? 18 : undefined }}>{item.value}</div>
            <div className="stat-change">{item.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, padding: '0 32px', marginBottom: 24 }}>
        <div className="card">
          <h3 className="chart-title">Top Selling Products</h3>
          {topProducts.length === 0 ? (
            <p className="text-muted text-sm">No sales data yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {topProducts.map((product, index) => (
                <div key={index} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: index === 0 ? '#fef3c7' : '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700 }}>
                    {index + 1}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{product.productName}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{product.category}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{product.totalQuantity} units</div>
                    <div style={{ fontSize: 12, color: 'var(--primary)' }}>{fmt(product.totalRevenue)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h3 className="chart-title">Customer Ledger Snapshot</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            <div className="stat-card" style={{ padding: 16 }}>
              <div className="stat-label">Customers</div>
              <div className="stat-value">{customerSummary?.customerCount ?? 0}</div>
              <div className="stat-change">{customerSummary?.customersWithOutstanding ?? 0} with due balance</div>
            </div>
            <div className="stat-card" style={{ padding: 16 }}>
              <div className="stat-label">Recovered</div>
              <div className="stat-value">{fmt(customerSummary?.totalCreditRecovered)}</div>
              <div className="stat-change">Against {fmt(customerSummary?.totalCreditExtended)} extended</div>
            </div>
          </div>
          <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => onNavigate('reports')}>Open Reports & Ledger</button>
        </div>
      </div>

      <div style={{ padding: '0 32px' }}>
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
            <h3 className="chart-title" style={{ marginBottom: 0 }}>Recent Orders</h3>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: 4, background: '#f3f4f6', borderRadius: 10, padding: 4 }}>
                {[
                  { k: 'ALL', l: 'All' },
                  { k: 'PENDING', l: 'Active' },
                  { k: 'COMPLETED', l: 'Completed/Delivered' },
                ].map(f => (
                  <button key={f.k} onClick={() => setOrderFilter(f.k)}
                    style={{ padding: '6px 12px', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600, background: orderFilter === f.k ? '#fff' : 'transparent', color: orderFilter === f.k ? '#111' : '#6b7280', boxShadow: orderFilter === f.k ? '0 1px 3px rgba(0,0,0,.1)' : 'none' }}>
                    {f.l}
                  </button>
                ))}
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('pos')}>+ New Sale</button>
            </div>
          </div>
          {(() => {
            const filtered = orderFilter === 'ALL' ? allOrders : allOrders.filter(o => o.status === orderFilter);
            const recentOrders = filtered.slice(0, 5);
            if (recentOrders.length === 0) {
              return <p className="text-muted text-sm">No orders to show.</p>;
            }
            return (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Order #</th>
                    <th>Customer</th>
                    <th>Items</th>
                    <th>Total</th>
                    <th>Paid</th>
                    <th>Due</th>
                    <th>Status</th>
                    <th>Payment</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((order) => {
                    const sc = ORDER_STATUS_CFG[order.status] || {};
                    return (
                    <tr key={order.id} onClick={() => setSelectedOrderId(order.id)} style={{ cursor: 'pointer' }}>
                      <td style={{ fontWeight: 600, color: 'var(--primary)', fontSize: 12 }}>{order.orderNumber}</td>
                      <td>{order.customerName || 'Walk-in'}</td>
                      <td>{order.items?.length || 0}</td>
                      <td style={{ fontWeight: 600 }}>{fmt(order.totalAmount)}</td>
                      <td>{fmt(order.amountPaid)}</td>
                      <td>{fmt(order.balanceDue)}</td>
                      <td><span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: sc.bg || '#f3f4f6', color: sc.color || '#374151' }}>{sc.label || order.status}</span></td>
                      <td><span className="badge badge-info">{order.paymentMethod}{order.balanceDue > 0 ? ` / ${order.paymentStatus}` : ''}</span></td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{new Date(order.createdAt).toLocaleString('en-IN')}</td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            );
          })()}
        </div>
      </div>

      {selectedOrderId && (
        <OrderDetailsModal orderId={selectedOrderId} onClose={() => setSelectedOrderId(null)} />
      )}
    </div>
  );
}
