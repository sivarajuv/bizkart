import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { customerAPI, orderAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { buildCollectionMessage, openSmsShare, openWhatsAppShare } from '../utils/customerSharing';

const COLORS = ['#1a7a4a', '#22a05e', '#f4a823', '#3b82f6', '#ef4444', '#8b5cf6'];

function PaymentCollectionCard({ customers, onSaved }) {
  const { user } = useAuth();
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('CASH');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [shareReceipt, setShareReceipt] = useState(null);

  const selectedCustomer = customers.find((item) => item.id === Number(selectedCustomerId));

  const handleSave = async () => {
    if (!selectedCustomerId || !amount) {
      alert('Select customer and amount');
      return;
    }
    setSaving(true);
    try {
      await customerAPI.recordPayment(selectedCustomerId, { amount: Number(amount), paymentMethod: method, note });
      const remainingBalance = Math.max(Number(selectedCustomer?.outstandingBalance || 0) - Number(amount || 0), 0);
      setShareReceipt({
        phone: selectedCustomer?.phone || '',
        message: buildCollectionMessage({
          customerName: selectedCustomer?.name,
          shopName: user?.shop?.name,
          amountCollected: amount,
          remainingBalance,
          paymentMethod: method,
        }),
      });
      setAmount('');
      setNote('');
      onSaved();
    } catch (error) {
      alert(error.response?.data?.error || 'Unable to record collection');
    }
    setSaving(false);
  };

  return (
    <div className="card">
      <h3 className="chart-title">Collect Customer Payment</h3>
      <div className="form-group">
        <label className="form-label">Customer</label>
        <select className="form-select" value={selectedCustomerId} onChange={(e) => setSelectedCustomerId(e.target.value)}>
          <option value="">Select customer</option>
          {customers.filter((item) => Number(item.outstandingBalance) > 0).map((item) => (
            <option key={item.id} value={item.id}>{item.name} • {item.phone || 'No phone'} • Due ₹{Number(item.outstandingBalance).toLocaleString('en-IN')}</option>
          ))}
        </select>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Amount</label>
          <input className="form-input" type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} max={selectedCustomer?.outstandingBalance || undefined} />
        </div>
        <div className="form-group">
          <label className="form-label">Method</label>
          <select className="form-select" value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="CASH">CASH</option>
            <option value="UPI">UPI</option>
            <option value="CARD">CARD</option>
          </select>
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Note</label>
        <input className="form-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note" />
      </div>
      {selectedCustomer && <div className="stat-change" style={{ marginBottom: 12 }}>Current outstanding: ₹{Number(selectedCustomer.outstandingBalance).toLocaleString('en-IN')}</div>}
      {shareReceipt && (
        <div className="card" style={{ padding: 12, marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Share collection update</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => openWhatsAppShare(shareReceipt.phone, shareReceipt.message)} disabled={!shareReceipt.phone}>WhatsApp</button>
            <button className="btn btn-secondary btn-sm" onClick={() => openSmsShare(shareReceipt.phone, shareReceipt.message)} disabled={!shareReceipt.phone}>SMS</button>
          </div>
        </div>
      )}
      <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Record Collection'}</button>
    </div>
  );
}

export default function Reports() {
  const { t } = useLanguage();
  const [stats, setStats] = useState(null);
  const [topProducts, setTopProducts] = useState([]);
  const [categoryStats, setCategoryStats] = useState([]);
  const [dailyRevenue, setDailyRevenue] = useState([]);
  const [profitLoss, setProfitLoss] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [aiInsights, setAiInsights] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [statsRes, topProductsRes, categoriesRes, dailyRevenueRes, profitLossRes, customerRes, ledgerRes] = await Promise.all([
        orderAPI.getDashboardStats(),
        orderAPI.getTopProducts(),
        orderAPI.getSalesByCategory(),
        orderAPI.getDailyRevenue(),
        orderAPI.getProfitLoss(),
        customerAPI.getAll(),
        customerAPI.getLedger(),
      ]);
      setStats(statsRes.data);
      setTopProducts(topProductsRes.data);
      setCategoryStats(categoriesRes.data);
      setDailyRevenue(dailyRevenueRes.data);
      setProfitLoss(profitLossRes.data);
      setCustomers(customerRes.data);
      setLedger(ledgerRes.data.slice(0, 20));
    } catch (loadError) {
      setError(
        loadError?.response?.data?.error ||
        loadError?.response?.data?.message ||
        loadError.message ||
        'Unable to load reports'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const getAIInsights = async () => {
    try {
      const response = await orderAPI.getAIInsights();
      setAiInsights(response.data.insights);
    } catch (insightError) {
      alert(
        insightError?.response?.data?.error ||
        insightError?.response?.data?.message ||
        insightError.message ||
        'Unable to generate AI insights'
      );
    }
  };

  const paymentData = stats?.paymentMethodStats ? Object.entries(stats.paymentMethodStats).map(([name, value]) => ({ name, value })) : [];
  const fmt = (value) => `₹${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 0 })}`;

  if (loading) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}><div className="loading-dots"><span /><span /><span /></div></div>;
  }

  if (error) {
    return (
      <div>
        <div className="page-header">
          <h1 className="page-title">{t('reports')}</h1>
          <p className="page-subtitle">Revenue, gross profit, and customer ledger across categories</p>
        </div>
        <div className="reports-layout">
          <div className="card">
            <h3 className="chart-title">Unable to Load Reports</h3>
            <p className="text-muted" style={{ marginBottom: 16 }}>{error}</p>
            <button className="btn btn-primary" onClick={load}>Retry</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 className="page-title">{t('reports')}</h1>
            <p className="page-subtitle">Revenue, gross profit, and customer ledger across categories</p>
          </div>
          <button className="btn btn-primary" onClick={getAIInsights}>Get AI Insights</button>
        </div>
      </div>

      {aiInsights && <div style={{ padding: '0 32px 20px' }}><div className="ai-insight-box">{aiInsights}</div></div>}

      <div className="reports-layout">
        <div className="responsive-four-grid" style={{ marginBottom: 20 }}>
          {[
            { label: t('totalOrders'), value: stats?.totalOrders ?? 0 },
            { label: t('totalRevenue'), value: fmt(stats?.totalRevenue) },
            { label: 'Gross Profit', value: fmt(profitLoss?.grossProfit) },
            { label: 'Outstanding Credit', value: fmt(profitLoss?.outstandingCredit) },
          ].map((item, index) => (
            <div key={index} className="stat-card">
              <div className="stat-label">{item.label}</div>
              <div className="stat-value">{item.value}</div>
            </div>
          ))}
        </div>

        <div className="reports-grid">
          <div className="chart-card" style={{ gridColumn: 'span 2' }}>
            <h3 className="chart-title">Daily Revenue Trend</h3>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={dailyRevenue}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value) => fmt(value)} />
                <Line type="monotone" dataKey="revenue" stroke="var(--primary)" strokeWidth={2.5} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-card">
            <h3 className="chart-title">Top Products</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={topProducts.slice(0, 8)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis type="number" />
                <YAxis type="category" dataKey="productName" width={110} />
                <Tooltip />
                <Bar dataKey="totalQuantity" fill="var(--primary)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-card">
            <h3 className="chart-title">Revenue by Category</h3>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={categoryStats} dataKey="totalRevenue" nameKey="category" cx="50%" cy="50%" outerRadius={80}>
                  {categoryStats.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(value) => fmt(value)} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-card">
            <h3 className="chart-title">Payment Methods</h3>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={paymentData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}>
                  {paymentData.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="responsive-two-grid" style={{ marginTop: 24 }}>
          <div className="card">
            <h3 className="chart-title">Profit & Loss Snapshot</h3>
            <div className="table-container">
              <table>
                <tbody>
                  <tr><td>Revenue</td><td style={{ fontWeight: 700 }}>{fmt(profitLoss?.revenue)}</td></tr>
                  <tr><td>Collections Received</td><td style={{ fontWeight: 700 }}>{fmt(profitLoss?.collections)}</td></tr>
                  <tr><td>Outstanding Credit</td><td style={{ fontWeight: 700 }}>{fmt(profitLoss?.outstandingCredit)}</td></tr>
                  <tr><td>Cost of Goods Sold</td><td style={{ fontWeight: 700 }}>{fmt(profitLoss?.costOfGoodsSold)}</td></tr>
                  <tr><td>Gross Profit</td><td style={{ fontWeight: 700, color: 'var(--primary)' }}>{fmt(profitLoss?.grossProfit)}</td></tr>
                  <tr><td>Gross Margin</td><td style={{ fontWeight: 700 }}>{Number(profitLoss?.grossMarginPercent || 0).toFixed(2)}%</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <PaymentCollectionCard customers={customers} onSaved={load} />
        </div>

        <div className="responsive-two-grid" style={{ marginTop: 24 }}>
          <div className="card">
            <h3 className="chart-title">Customers with Due Balance</h3>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Mobile</th>
                    <th>Outstanding</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.filter((item) => Number(item.outstandingBalance) > 0).slice(0, 10).map((customer) => (
                    <tr key={customer.id}>
                      <td>{customer.name}</td>
                      <td>{customer.phone || '—'}</td>
                      <td style={{ fontWeight: 700 }}>{fmt(customer.outstandingBalance)}</td>
                    </tr>
                  ))}
                  {customers.every((item) => Number(item.outstandingBalance) === 0) && (
                    <tr><td colSpan={3} style={{ color: 'var(--text-muted)' }}>No outstanding ledger balances.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <h3 className="chart-title">Recent Ledger Entries</h3>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Customer</th>
                    <th>Type</th>
                    <th>Amount</th>
                    <th>Balance After</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.map((entry) => (
                    <tr key={entry.id}>
                      <td>{new Date(entry.createdAt).toLocaleString('en-IN')}</td>
                      <td>{entry.customer?.name}</td>
                      <td><span className={`badge badge-${entry.direction === 'DEBIT' ? 'warning' : 'success'}`}>{entry.entryType}</span></td>
                      <td>{fmt(entry.amount)}</td>
                      <td style={{ fontWeight: 700 }}>{fmt(entry.balanceAfter)}</td>
                    </tr>
                  ))}
                  {ledger.length === 0 && <tr><td colSpan={5} style={{ color: 'var(--text-muted)' }}>No ledger activity yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
